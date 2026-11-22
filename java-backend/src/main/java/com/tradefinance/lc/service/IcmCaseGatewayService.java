package com.tradefinance.lc.service;

import com.tradefinance.lc.config.IcmProperties;
import com.tradefinance.lc.dto.IcmDtos.*;
import com.tradefinance.lc.service.IcmCaseCreationService.IcmCreationResult;
import jakarta.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Orchestrator Gateway delegating to cleanly separated services:
 *  - IntakeConfigPropertiesService (configurable roles & fields from case-intake.properties)
 *  - CustomIntakeService (MySQL persistence + 6-digit WID generation/storage)
 *  - IcmCaseCreationService (IBM ICM CaseCreation API + PE step dispatch)
 *  - FileNetDocumentService (FileNet CE multi-document upload & case filing)
 */
@Service
@RequiredArgsConstructor
public class IcmCaseGatewayService {

    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final IcmProperties icmProps;
    private final IntakeConfigPropertiesService intakeConfigService;
    private final CustomIntakeService customIntakeService;
    private final IcmCaseCreationService icmCaseCreationService;
    private final FileNetDocumentService fileNetDocumentService;

    private final Map<String, WorkItemDto> icmWorkQueue = new ConcurrentHashMap<>();
    private final List<InBasketDto> inBaskets = new ArrayList<>();

    @PostConstruct
    public void init() {
        inBaskets.add(new InBasketDto("checker-4eyes", "Trade Checker (4-Eyes)", "TF_LC_CHECKER",
                "Verification of MT700 issuance, amendments, and credit limit utilization"));
        inBaskets.add(new InBasketDto("doc-exam", "Document Examination", "TF_DOC_EXAMINER",
                "UCP 600 presentation review, invoice & transport discrepancy checking"));
        inBaskets.add(new InBasketDto("lc-maker", "LC Maker Queue", "TF_LC_MAKER",
                "Initial data capture, SWIFT tag drafting, and newly created intake cases"));
        inBaskets.add(new InBasketDto("compliance", "Sanctions & TBML", "TF_COMPLIANCE",
                "Vessel screening, dual-use goods checks, and AML escalation"));
        inBaskets.add(new InBasketDto("my-work", "My Assigned Work", "PERSONAL_INBOX",
                "Items claimed or directly assigned to active operator"));

        seedSampleWorkItem();
    }

    public IntakeConfigResponse getIntakeConfig() {
        IntakeRoleConfigDto roleConfig = intakeConfigService.getRoleConfig();
        String wid = customIntakeService.generateUniqueWid(roleConfig.getWidDigits());
        return new IntakeConfigResponse(
                roleConfig,
                wid,
                intakeConfigService.getDocumentClasses(),
                intakeConfigService.getIntakeFields()
        );
    }

    /**
     * Orchestrates full Case Creation across CustomService -> ICM CaseCreation -> FileNet CE.
     * Validates mandatory fields configured in case-intake.properties, stores the 6-digit WID,
     * passes WID to IBM ICM CaseCreation, and files all uploaded documents to the Maker Case.
     */
    @Transactional
    public WorkItemDto createCase(CreateCaseRequest request) {
        IntakeRoleConfigDto roleConfig = intakeConfigService.getRoleConfig();
        List<IntakeFieldConfigDto> schemaFields = intakeConfigService.getIntakeFields();
        Map<String, String> submitted = request.fields() != null ? request.fields() : Map.of();
        String actor = (request.actor() != null && !request.actor().isBlank())
                ? request.actor()
                : roleConfig.getDefaultAssignee();

        // 1. Validate mandatory attributes driven dynamically by case-intake.properties
        List<String> missing = new ArrayList<>();
        for (IntakeFieldConfigDto cfg : schemaFields) {
            if (cfg.isRequired()) {
                String val = submitted.get(cfg.getKey());
                if (val == null || val.trim().isEmpty()) {
                    missing.add(cfg.getLabel());
                }
            }
        }
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Missing mandatory intake fields: " + String.join(", ", missing));
        }

        // 2. Generate / validate unique 6-digit WID in CustomIntakeService
        String wid = customIntakeService.resolveOrValidateWid(request.wid(), roleConfig.getWidDigits());

        // 3. Call separate IBM ICM CaseCreation Service passing the 6-digit WID & ICM properties
        IcmCreationResult created = icmCaseCreationService.createIcmCase(
                wid, roleConfig, schemaFields, submitted, actor);

        // 4. Call separate FileNet Document Service to file single or multiple uploaded documents
        List<UploadedDocumentDto> uploads = request.documents() != null ? request.documents() : List.of();
        List<IcmDocumentDto> filedDocs = fileNetDocumentService.uploadAndFileDocuments(
                wid, created.caseId(), created.lcReference(), uploads, actor);

        WorkItemDto workItem = created.workItem();
        workItem.setDocuments(filedDocs);

        if (!filedDocs.isEmpty()) {
            workItem.getAuditTrail().add(0, new AuditEntryDto(
                    "a-" + System.currentTimeMillis() + "-fn",
                    TS_FMT.format(LocalDateTime.now()),
                    actor,
                    "FileNet Filing Agent",
                    filedDocs.size() + " Document(s) Filed into Case Folder",
                    "Filed via FileNetDocumentService for WID " + wid,
                    "FileNet CE"));
        }

        // 5. Persist 6-digit WID intake header & CUSTOM_DB fields via separate CustomIntakeService
        customIntakeService.persistIntakeAndCustomFields(
                wid,
                created.caseId(),
                created.wobNum(),
                created.lcReference(),
                roleConfig,
                schemaFields,
                submitted,
                filedDocs.size(),
                actor
        );

        workItem.getAuditTrail().add(0, new AuditEntryDto(
                "a-" + System.currentTimeMillis() + "-custom",
                TS_FMT.format(LocalDateTime.now()),
                actor,
                "Custom DB Service",
                "WID " + wid + " Registered in Custom MySQL DB",
                "Stored intake header & custom fields in tf_lc_case_intake",
                "Custom DB"));

        icmWorkQueue.put(workItem.getWobNum(), workItem);
        return mergeWithCustomDb(workItem);
    }

    public List<InBasketDto> getInBaskets() {
        return inBaskets;
    }

    public List<WorkItemDto> getWorkItems(String inBasketId) {
        return icmWorkQueue.values().stream()
                .filter(w -> inBasketId == null || inBasketId.isBlank() || inBasketId.equals(w.getInBasketId()))
                .map(this::mergeWithCustomDb)
                .toList();
    }

    public Optional<WorkItemDto> getWorkItem(String wobNum) {
        return Optional.ofNullable(icmWorkQueue.get(wobNum)).map(this::mergeWithCustomDb);
    }

    public Optional<WorkItemDto> getCaseById(String caseId) {
        return icmWorkQueue.values().stream()
                .filter(w -> caseId.equals(w.getCaseId()) || caseId.equals(w.getLcReference()))
                .findFirst()
                .map(this::mergeWithCustomDb);
    }

    private WorkItemDto mergeWithCustomDb(WorkItemDto item) {
        customIntakeService.hydrateCustomFields(item.getCaseId(), item.getFields());
        for (CaseFieldDto field : item.getFields()) {
            refreshAttentionFlag(field);
        }
        return item;
    }

    @Transactional
    public WorkItemDto saveFields(String wobNum, Map<String, String> fieldValues, String actor) {
        WorkItemDto item = icmWorkQueue.get(wobNum);
        if (item == null) {
            throw new IllegalArgumentException("Work item not found: " + wobNum);
        }

        int icmCount = 0;
        int dbCount = 0;

        for (CaseFieldDto field : item.getFields()) {
            if (!field.isReadOnly() && fieldValues != null && fieldValues.containsKey(field.getKey())) {
                String nextVal = Objects.toString(fieldValues.get(field.getKey()), "");
                field.setValue(nextVal);
                refreshAttentionFlag(field);

                if ("ICM".equals(field.getSource())) {
                    icmCaseCreationService.updateIcmCaseProperty(
                            item.getCaseId(), field.getIcmSymbolicName(), nextVal);
                    icmCount++;
                } else {
                    customIntakeService.persistCustomDbField(
                            item.getCaseId(), item.getLcReference(), field.getKey(),
                            field.getCustomDbColumn(), nextVal, actor);
                    dbCount++;
                }
            }
        }

        String now = TS_FMT.format(LocalDateTime.now());
        if (icmCount > 0) {
            item.getAuditTrail().add(0, new AuditEntryDto(
                    "a-" + System.currentTimeMillis() + "-icm",
                    now, actor, "Trade User", "ICM Properties Saved",
                    "Updated " + icmCount + " property(s) in IBM Case Manager (" + icmProps.getMode() + ")",
                    "IBM ICM"));
        }
        if (dbCount > 0) {
            item.getAuditTrail().add(0, new AuditEntryDto(
                    "a-" + System.currentTimeMillis() + "-db",
                    now, actor, "Trade User", "Custom DB Fields Saved",
                    "Persisted " + dbCount + " field(s) into MySQL tf_lc_custom_fields",
                    "Custom DB"));
        }

        return mergeWithCustomDb(item);
    }

    @Transactional
    public CompleteStepResponse completeStep(String wobNum, CompleteStepRequest req) {
        WorkItemDto item = saveFields(wobNum, req.fieldValues(), req.actor());
        icmCaseCreationService.dispatchWorkflowStep(wobNum, req.outcome());

        String previousBasket = item.getInBasketId();
        String outcome = req.outcome();
        if (outcome.toLowerCase().contains("return") || outcome.toLowerCase().contains("maker")) {
            item.setInBasketId("lc-maker");
            item.setStepName("Maker Correction");
            item.setStatus("Returned to Maker");
        } else if (outcome.toLowerCase().contains("checker")) {
            item.setInBasketId("checker-4eyes");
            item.setStepName("4-Eyes Checker Review");
            item.setStatus("Pending Checker Approval");
        } else {
            item.setStatus("Completed (" + outcome + ")");
        }

        item.getAuditTrail().add(0, new AuditEntryDto(
                "a-" + System.currentTimeMillis() + "-disp",
                TS_FMT.format(LocalDateTime.now()),
                req.actor(),
                "Trade User",
                "Step Completed: " + outcome,
                req.reason() != null ? req.reason() : "Dispatched via ICM Work API",
                "IBM ICM"));

        WorkItemDto next = icmWorkQueue.values().stream()
                .filter(w -> !w.getWobNum().equals(wobNum) && previousBasket.equals(w.getInBasketId()))
                .findFirst()
                .orElse(null);

        return new CompleteStepResponse(wobNum, item, next);
    }

    public WorkItemDto reassign(String wobNum, String targetUser, String actor) {
        WorkItemDto item = icmWorkQueue.get(wobNum);
        if (item == null) throw new IllegalArgumentException("Work item not found: " + wobNum);
        item.setAssignedTo(targetUser);
        item.getAuditTrail().add(0, new AuditEntryDto(
                "a-" + System.currentTimeMillis() + "-re",
                TS_FMT.format(LocalDateTime.now()),
                actor, "Trade User", "Work Item Reassigned",
                "Reassigned to " + targetUser, "IBM ICM"));
        return mergeWithCustomDb(item);
    }

    public WorkItemDto updateDocumentStatus(String caseId, String docId, DocumentStatusRequest req) {
        WorkItemDto item = getCaseById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));
        item.getDocuments().stream()
                .filter(d -> d.getId().equals(docId))
                .findFirst()
                .ifPresent(d -> {
                    d.setVerificationStatus(req.verificationStatus());
                    d.setDiscrepancyNote(req.discrepancyNote());
                });
        return item;
    }

    public WorkItemDto addComment(String caseId, CommentRequest req) {
        WorkItemDto item = getCaseById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));
        item.getComments().add(0, new CommentDto(
                "c-" + System.currentTimeMillis(),
                req.actor(), req.role(),
                TS_FMT.format(LocalDateTime.now()),
                req.message(), "NOTE"));
        return item;
    }

    private void refreshAttentionFlag(CaseFieldDto field) {
        boolean empty = field.getValue() == null || field.getValue().trim().isEmpty();
        if (field.isRequired() && empty) {
            field.setAttention("error");
        } else if ("error".equals(field.getAttention()) && !empty) {
            field.setAttention("none");
            field.setAttentionReason(null);
        }
    }

    private void seedSampleWorkItem() {
        WorkItemDto w = new WorkItemDto();
        w.setWid("842105");
        w.setWobNum("WOB-900142");
        w.setCaseId("CASE-LC-2026-0418");
        w.setLcReference("ILC-MUM-26-00418");
        w.setInBasketId("checker-4eyes");
        w.setProcessType("Import LC Issuance");
        w.setSubject("Import LC Issuance · Industrial Turbines & Control Modules");
        w.setApplicantName("Apex Heavy Engineering Ltd.");
        w.setBeneficiaryName("Siemens Energy Asia Pte Ltd");
        w.setIssuingBank("Meridian Trade Bank Mumbai");
        w.setAdvisingBank("DBS Bank Ltd, Singapore");
        w.setCurrency("USD");
        w.setAmount(1450000);
        w.setAmountFormatted("USD 1,450,000.00");
        w.setExpiryDate("2027-02-28");
        w.setLatestShipmentDate("2027-01-31");
        w.setIncoterms("CIF");
        w.setTenor("AT SIGHT");
        w.setStepName("4-Eyes Checker Review");
        w.setCaseMode("Expedited");
        w.setPriority("High");
        w.setAssignedTo("Ahmad Jamal");
        w.setMakerName("Priya Nair");
        w.setCheckerName("Ahmad Jamal");
        w.setRegion("West India · Mumbai");
        w.setBranchCode("TF-MUM-01");
        w.setSanctionsStatus("Cleared");
        w.setSlaRemainingMinutes(130);
        w.setSlaLabel("2h 10m left");
        w.setCreatedAt("2026-11-18T09:15:00Z");
        w.setEnteredQueueAt("2026-11-20T11:30:00Z");
        w.setAgeingDays(3.5);
        w.setAgeingLabel("3d 12h");
        w.setInQueueLabel("1d 10h");
        w.setStatus("Pending Checker Approval");
        w.setLinkedCasesCount(1);
        w.setStepOutcomes(List.of("Approve & Release MT700", "Return to Maker for Correction", "Refer to Sanctions / TBML", "Reject Application"));
        w.setStages(List.of(
                new WorkflowStageDto("s1", "Intake & Limit Block", "completed", "Trade Portal", "18 Nov 09:15"),
                new WorkflowStageDto("s2", "LC Maker Draft", "completed", "Priya Nair", "20 Nov 11:28"),
                new WorkflowStageDto("s3", "4-Eyes Checker", "active", null, null),
                new WorkflowStageDto("s4", "MT700 Dispatched", "pending", null, null)
        ));

        List<CaseFieldDto> fields = new ArrayList<>();
        fields.add(makeField("f1", "lcReference", "LC Reference (20)", "01. Parties & Banking", 1, ":20:", "ICM", "LC_ReferenceNo", null, "text", w.getLcReference(), true, true, "none"));
        fields.add(makeField("f2", "applicantName", "Applicant Name (50)", "01. Parties & Banking", 1, ":50:", "ICM", "LC_ApplicantName", null, "text", w.getApplicantName(), true, false, "none"));
        fields.add(makeField("f3", "beneficiaryName", "Beneficiary Name (59)", "01. Parties & Banking", 1, ":59:", "ICM", "LC_BeneficiaryName", null, "text", w.getBeneficiaryName(), true, false, "none"));
        fields.add(makeField("f4", "lcAmount", "LC Amount (32B)", "02. Credit Amount & Tenor", 2, ":32B:", "ICM", "LC_Amount", null, "currency", "1,450,000.00", true, false, "none"));
        fields.add(makeField("f5", "sanctionsScreenRef", "Sanctions Screening Ref", "05. Compliance & Credit Risk", 5, null, "CUSTOM_DB", null, "sanctions_screen_ref", "text", "", true, false, "error"));
        fields.add(makeField("f6", "coreBankingRef", "Core Banking Booking Ref", "06. Custom Bank & Treasury (DB)", 6, null, "CUSTOM_DB", null, "cbs_booking_ref", "text", "", true, false, "error"));
        w.setFields(fields);

        IcmDocumentDto doc = new IcmDocumentDto(
                "DOC-MT700-418",
                "SWIFT_MT700_Draft_ILC-MUM-26-00418.txt",
                "SWIFT Message",
                "text/plain",
                "2026-11-21 09:42",
                "Priya Nair",
                2,
                "48 KB",
                "Pending",
                null,
                fileNetDocumentService.buildDaejaViewerUrl("DOC-MT700-418"),
                Map.of("lcReference", w.getLcReference()),
                List.of(new DocSectionDto("MT700 Header", List.of(
                        new DocRowDto(":20: Documentary Credit No.", w.getLcReference(), "lcReference"),
                        new DocRowDto(":32B: Amount", w.getAmountFormatted(), "lcAmount")
                )))
        );
        w.setDocuments(new ArrayList<>(List.of(doc)));
        w.setComments(new ArrayList<>());
        w.setTasks(new ArrayList<>());
        w.setRelatedCases(new ArrayList<>());
        w.setAuditTrail(new ArrayList<>());
        icmWorkQueue.put(w.getWobNum(), w);
    }

    private CaseFieldDto makeField(
            String id, String key, String label, String section, int order, String swiftTag,
            String source, String icmSym, String dbCol, String type, String val,
            boolean required, boolean readOnly, String attention) {
        CaseFieldDto f = new CaseFieldDto();
        f.setId(id);
        f.setKey(key);
        f.setLabel(label);
        f.setSection(section);
        f.setSectionOrder(order);
        f.setSwiftTag(swiftTag);
        f.setSource(source);
        f.setIcmSymbolicName(icmSym);
        f.setCustomDbColumn(dbCol);
        f.setType(type);
        f.setValue(val);
        f.setRequired(required);
        f.setReadOnly(readOnly);
        f.setAttention(attention);
        return f;
    }
}
