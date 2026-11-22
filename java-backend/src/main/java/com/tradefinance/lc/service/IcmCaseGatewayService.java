package com.tradefinance.lc.service;

import com.tradefinance.lc.config.IcmProperties;
import com.tradefinance.lc.dto.IcmDtos.*;
import com.tradefinance.lc.service.IcmCaseCreationService.IcmCreationResult;
import javax.annotation.PostConstruct;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
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
public class IcmCaseGatewayService {

    private static final String TS_PATTERN = "yyyy-MM-dd HH:mm";

    private final IcmProperties icmProps;
    private final IntakeConfigPropertiesService intakeConfigService;
    private final CustomIntakeService customIntakeService;
    private final IcmCaseCreationService icmCaseCreationService;
    private final FileNetDocumentService fileNetDocumentService;

    public IcmCaseGatewayService(
            IcmProperties icmProps,
            IntakeConfigPropertiesService intakeConfigService,
            CustomIntakeService customIntakeService,
            IcmCaseCreationService icmCaseCreationService,
            FileNetDocumentService fileNetDocumentService) {
        this.icmProps = icmProps;
        this.intakeConfigService = intakeConfigService;
        this.customIntakeService = customIntakeService;
        this.icmCaseCreationService = icmCaseCreationService;
        this.fileNetDocumentService = fileNetDocumentService;
    }

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
        Map<String, String> submitted = request.getFields() != null ? request.getFields() : Collections.<String, String>emptyMap();
        String actor = (request.getActor() != null && !request.getActor().trim().isEmpty())
                ? request.getActor()
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
            throw new IllegalArgumentException("Missing mandatory intake fields: " + joinWithComma(missing));
        }

        // 2. Generate / validate unique 6-digit WID in CustomIntakeService
        String wid = customIntakeService.resolveOrValidateWid(request.getWid(), roleConfig.getWidDigits());

        // 3. Call separate IBM ICM CaseCreation Service passing the 6-digit WID & ICM properties
        IcmCreationResult created = icmCaseCreationService.createIcmCase(
                wid, roleConfig, schemaFields, submitted, actor);

        // 4. Call separate FileNet Document Service to file single or multiple uploaded documents
        List<UploadedDocumentDto> uploads = request.getDocuments() != null ? request.getDocuments() : Collections.<UploadedDocumentDto>emptyList();
        List<IcmDocumentDto> filedDocs = fileNetDocumentService.uploadAndFileDocuments(
                wid, created.getCaseId(), created.getLcReference(), uploads, actor);

        WorkItemDto workItem = created.getWorkItem();
        workItem.setDocuments(filedDocs);

        if (!filedDocs.isEmpty()) {
            workItem.getAuditTrail().add(0, new AuditEntryDto(
                    "a-" + System.currentTimeMillis() + "-fn",
                    nowTimestamp(),
                    actor,
                    "FileNet Filing Agent",
                    filedDocs.size() + " Document(s) Filed into Case Folder",
                    "Filed via FileNetDocumentService for WID " + wid,
                    "FileNet CE"));
        }

        // 5. Persist 6-digit WID intake header & CUSTOM_DB fields via separate CustomIntakeService
        customIntakeService.persistIntakeAndCustomFields(
                wid,
                created.getCaseId(),
                created.getWobNum(),
                created.getLcReference(),
                roleConfig,
                schemaFields,
                submitted,
                filedDocs.size(),
                actor
        );

        workItem.getAuditTrail().add(0, new AuditEntryDto(
                "a-" + System.currentTimeMillis() + "-custom",
                nowTimestamp(),
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
        List<WorkItemDto> results = new ArrayList<WorkItemDto>();
        boolean includeAll = (inBasketId == null || inBasketId.trim().isEmpty());
        for (WorkItemDto item : icmWorkQueue.values()) {
            if (includeAll || inBasketId.equals(item.getInBasketId())) {
                results.add(mergeWithCustomDb(item));
            }
        }
        return results;
    }

    public WorkItemDto getWorkItem(String wobNum) {
        WorkItemDto item = icmWorkQueue.get(wobNum);
        return item != null ? mergeWithCustomDb(item) : null;
    }

    public WorkItemDto getCaseById(String caseId) {
        for (WorkItemDto item : icmWorkQueue.values()) {
            if (caseId.equals(item.getCaseId()) || caseId.equals(item.getLcReference())) {
                return mergeWithCustomDb(item);
            }
        }
        return null;
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

        String now = nowTimestamp();
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
        WorkItemDto item = saveFields(wobNum, req.getFieldValues(), req.getActor());
        icmCaseCreationService.dispatchWorkflowStep(wobNum, req.getOutcome());

        String previousBasket = item.getInBasketId();
        String outcome = req.getOutcome();
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
                nowTimestamp(),
                req.getActor(),
                "Trade User",
                "Step Completed: " + outcome,
                req.getReason() != null ? req.getReason() : "Dispatched via ICM Work API",
                "IBM ICM"));

        WorkItemDto next = null;
        for (WorkItemDto candidate : icmWorkQueue.values()) {
            if (!candidate.getWobNum().equals(wobNum) && previousBasket.equals(candidate.getInBasketId())) {
                next = candidate;
                break;
            }
        }

        return new CompleteStepResponse(wobNum, item, next);
    }

    public WorkItemDto reassign(String wobNum, String targetUser, String actor) {
        WorkItemDto item = icmWorkQueue.get(wobNum);
        if (item == null) throw new IllegalArgumentException("Work item not found: " + wobNum);
        item.setAssignedTo(targetUser);
        item.getAuditTrail().add(0, new AuditEntryDto(
                "a-" + System.currentTimeMillis() + "-re",
                nowTimestamp(),
                actor, "Trade User", "Work Item Reassigned",
                "Reassigned to " + targetUser, "IBM ICM"));
        return mergeWithCustomDb(item);
    }

    public WorkItemDto updateDocumentStatus(String caseId, String docId, DocumentStatusRequest req) {
        WorkItemDto item = getCaseById(caseId);
        if (item == null) {
            throw new IllegalArgumentException("Case not found: " + caseId);
        }
        for (IcmDocumentDto doc : item.getDocuments()) {
            if (doc.getId().equals(docId)) {
                doc.setVerificationStatus(req.getVerificationStatus());
                doc.setDiscrepancyNote(req.getDiscrepancyNote());
                break;
            }
        }
        return item;
    }

    public WorkItemDto addComment(String caseId, CommentRequest req) {
        WorkItemDto item = getCaseById(caseId);
        if (item == null) {
            throw new IllegalArgumentException("Case not found: " + caseId);
        }
        item.getComments().add(0, new CommentDto(
                "c-" + System.currentTimeMillis(),
                req.getActor(), req.getRole(),
                nowTimestamp(),
                req.getMessage(), "NOTE"));
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
        w.setStepOutcomes(Arrays.asList("Approve & Release MT700", "Return to Maker for Correction", "Refer to Sanctions / TBML", "Reject Application"));
        w.setStages(Arrays.asList(
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
                Collections.singletonMap("lcReference", w.getLcReference()),
                Collections.singletonList(new DocSectionDto("MT700 Header", Arrays.asList(
                        new DocRowDto(":20: Documentary Credit No.", w.getLcReference(), "lcReference"),
                        new DocRowDto(":32B: Amount", w.getAmountFormatted(), "lcAmount")
                )))
        );
        w.setDocuments(new ArrayList<>(Collections.singletonList(doc)));
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

    private String nowTimestamp() {
        return new SimpleDateFormat(TS_PATTERN).format(new Date());
    }

    private String joinWithComma(List<String> values) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                sb.append(", ");
            }
            sb.append(values.get(i));
        }
        return sb.toString();
    }
}
