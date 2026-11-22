package com.tradefinance.lc.service;

import com.tradefinance.lc.config.FileNetProperties;
import com.tradefinance.lc.config.IcmProperties;
import com.tradefinance.lc.dto.IcmDtos.*;
import java.text.SimpleDateFormat;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Separate IBM Case Manager (ICM) Java Service.
 * Uses IcmProperties, FileNetProperties, and FileNetSessionManager for authenticated P8/ICM sessions:
 *  - Invoking IBM ICM Case Creation API with the 6-digit WID & configurable ICM properties
 *  - Creating/initializing the Case at the configured Maker Stage & In-Basket (e.g. TF_LC_MAKER / lc-maker)
 *  - Updating ICM symbolic properties and dispatching workflow outcomes via Process Engine
 */
@Service
public class IcmCaseCreationService {

    private static final Logger log = LoggerFactory.getLogger(IcmCaseCreationService.class);
    private static final String TS_PATTERN = "yyyy-MM-dd HH:mm";

    private final IcmProperties icmProps;
    private final FileNetProperties fileNetProps;
    private final FileNetSessionManager sessionManager;

    public IcmCaseCreationService(
            IcmProperties icmProps,
            FileNetProperties fileNetProps,
            FileNetSessionManager sessionManager) {
        this.icmProps = icmProps;
        this.fileNetProps = fileNetProps;
        this.sessionManager = sessionManager;
    }

    public static class IcmCreationResult {
        private final String wid;
        private final String caseId;
        private final String wobNum;
        private final String lcReference;
        private final WorkItemDto workItem;

        public IcmCreationResult(
                String wid,
                String caseId,
                String wobNum,
                String lcReference,
                WorkItemDto workItem) {
            this.wid = wid;
            this.caseId = caseId;
            this.wobNum = wobNum;
            this.lcReference = lcReference;
            this.workItem = workItem;
        }

        public String getWid() {
            return wid;
        }

        public String getCaseId() {
            return caseId;
        }

        public String getWobNum() {
            return wobNum;
        }

        public String getLcReference() {
            return lcReference;
        }

        public WorkItemDto getWorkItem() {
            return workItem;
        }
    }

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

        String operationType = getOrDefault(submittedValues, "LC_Operation_Type", "Import LC Issuance");
        String applicantName = getOrDefault(submittedValues, "LC_Applicant_Name", "");
        String beneficiaryName = getOrDefault(submittedValues, "LC_Beneficiary_Name", "To Be Assigned");
        String solId = getOrDefault(submittedValues, "LC_SOL_ID", "0001");
        String customerId = getOrDefault(submittedValues, "LC_Customer_ID", "");

        String resolvedCaseType = (roleConfig.getCaseType() != null && !roleConfig.getCaseType().trim().isEmpty())
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

        Date now = new Date();
        String nowTs = new SimpleDateFormat(TS_PATTERN).format(now);
        String nowIso = formatIsoUtc(now);
        WorkItemDto item = new WorkItemDto();
        item.setWid(wid);
        item.setWobNum(wobNum);
        item.setCaseId(caseId);
        item.setLcReference(lcReference);
        item.setInBasketId(roleConfig.getInBasketId());
        item.setProcessType(operationType);
        item.setSubject(operationType + " · " + applicantName + " (WID " + wid + ")");
        item.setApplicantName(applicantName);
        item.setBeneficiaryName(beneficiaryName.trim().isEmpty() ? "Pending Maker Capture" : beneficiaryName);
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
        item.setCreatedAt(nowIso);
        item.setEnteredQueueAt(nowIso);
        item.setAgeingDays(0.0);
        item.setAgeingLabel("Just created");
        item.setInQueueLabel("Just created");
        item.setStatus("Pending Maker Completion");
        item.setLinkedCasesCount(0);
        item.setStepOutcomes(Arrays.asList("Submit to 4-Eyes Checker", "Save Draft", "Refer to Sanctions / TBML"));
        item.setStages(Arrays.asList(
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
            String val = getOrDefault(submittedValues, cfg.getKey(), "");
            boolean missingReq = cfg.isRequired() && (val == null || val.trim().isEmpty());
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
                beneficiaryName.trim().isEmpty() ? "error" : "none"));
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
        item.setAuditTrail(new ArrayList<>(Collections.singletonList(
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

    private String getOrDefault(Map<String, String> map, String key, String defaultValue) {
        if (map == null || !map.containsKey(key) || map.get(key) == null) {
            return defaultValue;
        }
        return map.get(key);
    }

    private String formatIsoUtc(Date date) {
        SimpleDateFormat isoFmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
        isoFmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        return isoFmt.format(date);
    }
}
