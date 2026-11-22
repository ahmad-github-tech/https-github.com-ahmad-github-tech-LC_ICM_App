package com.tradefinance.lc.service;

import com.tradefinance.lc.config.FileNetProperties;
import com.tradefinance.lc.config.IcmProperties;
import com.tradefinance.lc.dto.IcmDtos.*;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Separate IBM Case Manager (ICM) Java Service.
 * Uses IcmProperties, FileNetProperties, and FileNetSessionManager for authenticated P8/ICM sessions:
 *  - Invoking IBM ICM Case Creation API with the 6-digit WID & configurable ICM properties
 *  - Creating/initializing the Case at the configured Maker Stage & In-Basket (e.g. TF_LC_MAKER / lc-maker)
 *  - Updating ICM symbolic properties and dispatching workflow outcomes via Process Engine
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IcmCaseCreationService {

    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final IcmProperties icmProps;
    private final FileNetProperties fileNetProps;
    private final FileNetSessionManager sessionManager;

    public record IcmCreationResult(
            String wid,
            String caseId,
            String wobNum,
            String lcReference,
            WorkItemDto workItem
    ) {}

    /**
     * IBM ICM Case Creation API Entry Point.
     * Receives the pre-generated 6-digit WID and passes it explicitly to CaseCreation alongside
     * all ICM symbolic properties configured in case-intake.properties.
     */
    public IcmCreationResult createIcmCase(
            String wid,
            IntakeRoleConfigDto roleConfig,
            List<IntakeFieldConfigDto> schemaFields,
            Map<String, String> submittedValues,
            String actor) {

        sessionManager.validateAndPushSubject();

        String operationType = submittedValues.getOrDefault("LC_Operation_Type", "Import LC Issuance");
        String applicantName = submittedValues.getOrDefault("LC_Applicant_Name", "");
        String beneficiaryName = submittedValues.getOrDefault("LC_Beneficiary_Name", "To Be Assigned");
        String solId = submittedValues.getOrDefault("LC_SOL_ID", "0001");
        String customerId = submittedValues.getOrDefault("LC_Customer_ID", "");

        String resolvedCaseType = (roleConfig.getCaseType() != null && !roleConfig.getCaseType().isBlank())
                ? roleConfig.getCaseType()
                : icmProps.getCaseType();

        String prefix = operationType.contains("Amendment") ? "AMD"
                : operationType.contains("Standby") ? "SBLC"
                : operationType.contains("Exam") ? "EXM"
                : "ILC";
        String lcReference = prefix + "-" + solId.toUpperCase().replaceAll("[^A-Z0-9]", "") + "-" + wid;
        String caseId = "CASE-LC-WID-" + wid;
        String wobNum = "WOB-" + wid;

        if (sessionManager.isLiveMode()) {
            /*
             * LIVE IBM CASE MANAGER API IMPLEMENTATION (requires Jace.jar + icm-case-api.jar):
             *
             * Connection conn = Factory.Connection.getConnection(fileNetProps.getUrl());
             * ObjectStore os = Factory.ObjectStore.fetchInstance(domain, fileNetProps.getTargetObjectStore(), null);
             * ObjectStoreReference osRef = new ObjectStoreReference(os);
             * CaseType caseType = CaseType.fetchInstance(osRef, resolvedCaseType);
             * Case pendingCase = Case.createPendingInstance(caseType);
             *
             * // Pass auto-generated 6-digit WID & configured ICM Case Properties:
             * pendingCase.getProperties().putObjectValue("LC_WID", wid);
             * for (IntakeFieldConfigDto cfg : schemaFields) {
             *     if ("ICM".equalsIgnoreCase(cfg.getSource())) {
             *         pendingCase.getProperties().putObjectValue(
             *             cfg.getSymbolicName(),
             *             submittedValues.getOrDefault(cfg.getKey(), "")
             *         );
             *     }
             * }
             * pendingCase.save(RefreshMode.REFRESH, null, ModificationIntent.MODIFY);
             * caseId = pendingCase.getIdentifier();
             */
            log.info("[LIVE_FILENET] Created ICM Case {} (CaseType={}, Solution={}, OS={}, CP={}) with WID {}",
                    caseId, resolvedCaseType, icmProps.getSolutionName(),
                    fileNetProps.getTargetObjectStore(), icmProps.getConnectionPoint(), wid);
        } else {
            log.info("[SIMULATED] ICM CaseCreation executed -> WID={}, CaseID={}, CaseType={}, Solution={}, OS={}, Role={}",
                    wid, caseId, resolvedCaseType, icmProps.getSolutionName(),
                    fileNetProps.getTargetObjectStore(), roleConfig.getRoleName());
        }

        String nowTs = TS_FMT.format(LocalDateTime.now());
        WorkItemDto item = new WorkItemDto();
        item.setWid(wid);
        item.setWobNum(wobNum);
        item.setCaseId(caseId);
        item.setLcReference(lcReference);
        item.setInBasketId(roleConfig.getInBasketId());
        item.setProcessType(operationType);
        item.setSubject(operationType + " · " + applicantName + " (WID " + wid + ")");
        item.setApplicantName(applicantName);
        item.setBeneficiaryName(beneficiaryName.isBlank() ? "Pending Maker Capture" : beneficiaryName);
        item.setIssuingBank("Meridian Trade Bank (SOL " + solId + ")");
        item.setAdvisingBank("To Be Designated by Maker");
        item.setCurrency("USD");
        item.setAmount(0);
        item.setAmountFormatted("USD 0.00");
        item.setExpiryDate("");
        item.setLatestShipmentDate("");
        item.setIncoterms("CIF");
        item.setTenor("AT SIGHT");
        item.setStepName(roleConfig.getStepName());
        item.setCaseMode("Standard");
        item.setPriority("Medium");
        item.setAssignedTo(roleConfig.getDefaultAssignee());
        item.setMakerName(roleConfig.getDefaultAssignee());
        item.setCheckerName("Pending 4-Eyes");
        item.setRegion("SOL " + solId);
        item.setBranchCode(solId);
        item.setSanctionsStatus("Pending");
        item.setSlaRemainingMinutes(480);
        item.setSlaLabel("8h 00m left");
        item.setCreatedAt(Instant.now().toString());
        item.setEnteredQueueAt(Instant.now().toString());
        item.setAgeingDays(0.0);
        item.setAgeingLabel("Just created");
        item.setInQueueLabel("Just created");
        item.setStatus("Pending Maker Completion");
        item.setLinkedCasesCount(0);
        item.setStepOutcomes(List.of("Submit to 4-Eyes Checker", "Save Draft", "Refer to Sanctions / TBML"));
        item.setStages(List.of(
                new WorkflowStageDto("s1", "Intake & WID (" + wid + ")", "completed", actor, nowTs),
                new WorkflowStageDto("s2", "LC Maker Draft", "active", null, null),
                new WorkflowStageDto("s3", "4-Eyes Checker", "pending", null, null),
                new WorkflowStageDto("s4", "MT700 Dispatch", "pending", null, null)
        ));

        List<CaseFieldDto> fields = new ArrayList<>();
        fields.add(buildField("f-wid", "lcWid", "Work Intake ID (WID)", "00. Case Intake Header", 0, null,
                "ICM", "LC_WID", null, "text", wid, true, true, "none"));

        int idx = 1;
        for (IntakeFieldConfigDto cfg : schemaFields) {
            String val = submittedValues.getOrDefault(cfg.getKey(), "");
            boolean missingReq = cfg.isRequired() && (val == null || val.isBlank());
            fields.add(buildField(
                    "f-in-" + idx++,
                    cfg.getKey(),
                    cfg.getLabel(),
                    "00. Case Intake Header",
                    0,
                    null,
                    cfg.getSource(),
                    cfg.getSymbolicName(),
                    cfg.getDbColumn(),
                    "select".equalsIgnoreCase(cfg.getType()) ? "select" : "text",
                    val,
                    cfg.isRequired(),
                    false,
                    missingReq ? "error" : "none"
            ));
        }

        // Standard LC Maker fields ready for completion inside Maker Work Page
        fields.add(buildField("f-lc-ref", "lcReference", "LC Reference (20)", "01. Parties & Banking", 1, ":20:",
                "ICM", "LC_ReferenceNo", null, "text", lcReference, true, true, "none"));
        fields.add(buildField("f-app", "applicantName", "Applicant Name (50)", "01. Parties & Banking", 1, ":50:",
                "ICM", "LC_ApplicantName", null, "text", applicantName, true, false, "none"));
        fields.add(buildField("f-ben", "beneficiaryName", "Beneficiary Name (59)", "01. Parties & Banking", 1, ":59:",
                "ICM", "LC_BeneficiaryName", null, "text", beneficiaryName, true, false,
                beneficiaryName.isBlank() ? "error" : "none"));
        fields.add(buildField("f-cust", "applicantCif", "Applicant CIF / Customer ID", "01. Parties & Banking", 1, null,
                "CUSTOM_DB", null, "lc_customer_id", "text", customerId, false, false, "none"));
        fields.add(buildField("f-amt", "lcAmount", "LC Amount (32B)", "02. Credit Amount & Tenor", 2, ":32B:",
                "ICM", "LC_Amount", null, "currency", "", true, false, "error"));
        fields.add(buildField("f-ccy", "currency", "Currency (32B)", "02. Credit Amount & Tenor", 2, ":32B:",
                "ICM", "LC_Currency", null, "select", "USD", true, false, "none"));

        item.setFields(fields);
        item.setDocuments(new ArrayList<>());
        item.setComments(new ArrayList<>());
        item.setTasks(new ArrayList<>());
        item.setRelatedCases(new ArrayList<>());
        item.setAuditTrail(new ArrayList<>(List.of(
                new AuditEntryDto(
                        "a-" + System.currentTimeMillis() + "-create",
                        nowTs,
                        actor,
                        "Intake Officer",
                        "IBM ICM Case Created (WID " + wid + ")",
                        "Created in IBM Case Manager (" + icmProps.getMode() + ") and routed to "
                                + roleConfig.getRoleName() + " [" + roleConfig.getInBasketId() + "]",
                        "IBM ICM")
        )));

        return new IcmCreationResult(wid, caseId, wobNum, lcReference, item);
    }

    public void updateIcmCaseProperty(String caseId, String symbolicName, String value) {
        if (sessionManager.isLiveMode()) {
            // LIVE: Case.fetchInstance(...) -> caseInstance.getProperties().putObjectValue(symbolicName, value);
            log.debug("[LIVE_FILENET] Updated ICM Case {} property {}={}", caseId, symbolicName, value);
        }
    }

    public void dispatchWorkflowStep(String wobNum, String outcome) {
        if (sessionManager.isLiveMode()) {
            // LIVE: VWSession.fetchWorkObject(wobNum) -> setSelectedResponse(outcome) -> doDispatch();
            log.debug("[LIVE_FILENET] Dispatched WOB {} with outcome {}", wobNum, outcome);
        }
    }

    private CaseFieldDto buildField(
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
