package com.tradefinance.lc.dto;

import java.util.List;
import java.util.Map;

public class IcmDtos {

    public static class InBasketDto {
        private String id;
        private String name;
        private String roleName;
        private String description;

        public InBasketDto() {
        }

        public InBasketDto(String id, String name, String roleName, String description) {
            this.id = id;
            this.name = name;
            this.roleName = roleName;
            this.description = description;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getRoleName() { return roleName; }
        public void setRoleName(String roleName) { this.roleName = roleName; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    public static class CaseFieldDto {
        private String id;
        private String key;
        private String label;
        private String section;
        private int sectionOrder;
        private String swiftTag;
        private String source; // "ICM" or "CUSTOM_DB"
        private String icmSymbolicName;
        private String customDbColumn;
        private String type;
        private String value;
        private List<String> options;
        private boolean required;
        private boolean readOnly;
        private String attention;
        private String attentionReason;
        private String placeholder;
        private boolean fullWidth;
        private String linkedDocHighlight;

        public CaseFieldDto() {
        }

        public CaseFieldDto(
                String id, String key, String label, String section, int sectionOrder,
                String swiftTag, String source, String icmSymbolicName, String customDbColumn,
                String type, String value, List<String> options, boolean required, boolean readOnly,
                String attention, String attentionReason, String placeholder,
                boolean fullWidth, String linkedDocHighlight) {
            this.id = id;
            this.key = key;
            this.label = label;
            this.section = section;
            this.sectionOrder = sectionOrder;
            this.swiftTag = swiftTag;
            this.source = source;
            this.icmSymbolicName = icmSymbolicName;
            this.customDbColumn = customDbColumn;
            this.type = type;
            this.value = value;
            this.options = options;
            this.required = required;
            this.readOnly = readOnly;
            this.attention = attention;
            this.attentionReason = attentionReason;
            this.placeholder = placeholder;
            this.fullWidth = fullWidth;
            this.linkedDocHighlight = linkedDocHighlight;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public String getSection() { return section; }
        public void setSection(String section) { this.section = section; }
        public int getSectionOrder() { return sectionOrder; }
        public void setSectionOrder(int sectionOrder) { this.sectionOrder = sectionOrder; }
        public String getSwiftTag() { return swiftTag; }
        public void setSwiftTag(String swiftTag) { this.swiftTag = swiftTag; }
        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }
        public String getIcmSymbolicName() { return icmSymbolicName; }
        public void setIcmSymbolicName(String icmSymbolicName) { this.icmSymbolicName = icmSymbolicName; }
        public String getCustomDbColumn() { return customDbColumn; }
        public void setCustomDbColumn(String customDbColumn) { this.customDbColumn = customDbColumn; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getValue() { return value; }
        public void setValue(String value) { this.value = value; }
        public List<String> getOptions() { return options; }
        public void setOptions(List<String> options) { this.options = options; }
        public boolean isRequired() { return required; }
        public void setRequired(boolean required) { this.required = required; }
        public boolean isReadOnly() { return readOnly; }
        public void setReadOnly(boolean readOnly) { this.readOnly = readOnly; }
        public String getAttention() { return attention; }
        public void setAttention(String attention) { this.attention = attention; }
        public String getAttentionReason() { return attentionReason; }
        public void setAttentionReason(String attentionReason) { this.attentionReason = attentionReason; }
        public String getPlaceholder() { return placeholder; }
        public void setPlaceholder(String placeholder) { this.placeholder = placeholder; }
        public boolean isFullWidth() { return fullWidth; }
        public void setFullWidth(boolean fullWidth) { this.fullWidth = fullWidth; }
        public String getLinkedDocHighlight() { return linkedDocHighlight; }
        public void setLinkedDocHighlight(String linkedDocHighlight) { this.linkedDocHighlight = linkedDocHighlight; }
    }

    public static class DocRowDto {
        private String label;
        private String value;
        private String highlightKey;

        public DocRowDto() {
        }

        public DocRowDto(String label, String value, String highlightKey) {
            this.label = label;
            this.value = value;
            this.highlightKey = highlightKey;
        }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public String getValue() { return value; }
        public void setValue(String value) { this.value = value; }
        public String getHighlightKey() { return highlightKey; }
        public void setHighlightKey(String highlightKey) { this.highlightKey = highlightKey; }
    }

    public static class DocSectionDto {
        private String heading;
        private List<DocRowDto> rows;

        public DocSectionDto() {
        }

        public DocSectionDto(String heading, List<DocRowDto> rows) {
            this.heading = heading;
            this.rows = rows;
        }

        public String getHeading() { return heading; }
        public void setHeading(String heading) { this.heading = heading; }
        public List<DocRowDto> getRows() { return rows; }
        public void setRows(List<DocRowDto> rows) { this.rows = rows; }
    }

    public static class IcmDocumentDto {
        private String id;
        private String title;
        private String docClass;
        private String mimeType;
        private String addedAt;
        private String addedBy;
        private int pageCount;
        private String sizeLabel;
        private String verificationStatus;
        private String discrepancyNote;
        private String viewerUrl;
        private Map<String, String> highlights;
        private List<DocSectionDto> previewSections;

        public IcmDocumentDto() {
        }

        public IcmDocumentDto(
                String id, String title, String docClass, String mimeType, String addedAt,
                String addedBy, int pageCount, String sizeLabel, String verificationStatus,
                String discrepancyNote, String viewerUrl, Map<String, String> highlights,
                List<DocSectionDto> previewSections) {
            this.id = id;
            this.title = title;
            this.docClass = docClass;
            this.mimeType = mimeType;
            this.addedAt = addedAt;
            this.addedBy = addedBy;
            this.pageCount = pageCount;
            this.sizeLabel = sizeLabel;
            this.verificationStatus = verificationStatus;
            this.discrepancyNote = discrepancyNote;
            this.viewerUrl = viewerUrl;
            this.highlights = highlights;
            this.previewSections = previewSections;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getDocClass() { return docClass; }
        public void setDocClass(String docClass) { this.docClass = docClass; }
        public String getMimeType() { return mimeType; }
        public void setMimeType(String mimeType) { this.mimeType = mimeType; }
        public String getAddedAt() { return addedAt; }
        public void setAddedAt(String addedAt) { this.addedAt = addedAt; }
        public String getAddedBy() { return addedBy; }
        public void setAddedBy(String addedBy) { this.addedBy = addedBy; }
        public int getPageCount() { return pageCount; }
        public void setPageCount(int pageCount) { this.pageCount = pageCount; }
        public String getSizeLabel() { return sizeLabel; }
        public void setSizeLabel(String sizeLabel) { this.sizeLabel = sizeLabel; }
        public String getVerificationStatus() { return verificationStatus; }
        public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }
        public String getDiscrepancyNote() { return discrepancyNote; }
        public void setDiscrepancyNote(String discrepancyNote) { this.discrepancyNote = discrepancyNote; }
        public String getViewerUrl() { return viewerUrl; }
        public void setViewerUrl(String viewerUrl) { this.viewerUrl = viewerUrl; }
        public Map<String, String> getHighlights() { return highlights; }
        public void setHighlights(Map<String, String> highlights) { this.highlights = highlights; }
        public List<DocSectionDto> getPreviewSections() { return previewSections; }
        public void setPreviewSections(List<DocSectionDto> previewSections) { this.previewSections = previewSections; }
    }

    public static class WorkflowStageDto {
        private String id;
        private String label;
        private String status;
        private String completedBy;
        private String completedAt;

        public WorkflowStageDto() {
        }

        public WorkflowStageDto(String id, String label, String status, String completedBy, String completedAt) {
            this.id = id;
            this.label = label;
            this.status = status;
            this.completedBy = completedBy;
            this.completedAt = completedAt;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getCompletedBy() { return completedBy; }
        public void setCompletedBy(String completedBy) { this.completedBy = completedBy; }
        public String getCompletedAt() { return completedAt; }
        public void setCompletedAt(String completedAt) { this.completedAt = completedAt; }
    }

    public static class CommentDto {
        private String id;
        private String author;
        private String role;
        private String timestamp;
        private String message;
        private String actionType;

        public CommentDto() {
        }

        public CommentDto(String id, String author, String role, String timestamp, String message, String actionType) {
            this.id = id;
            this.author = author;
            this.role = role;
            this.timestamp = timestamp;
            this.message = message;
            this.actionType = actionType;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getAuthor() { return author; }
        public void setAuthor(String author) { this.author = author; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public String getActionType() { return actionType; }
        public void setActionType(String actionType) { this.actionType = actionType; }
    }

    public static class TaskDto {
        private String id;
        private String title;
        private String assignedRole;
        private String assignee;
        private String status;
        private String dueDate;

        public TaskDto() {
        }

        public TaskDto(String id, String title, String assignedRole, String assignee, String status, String dueDate) {
            this.id = id;
            this.title = title;
            this.assignedRole = assignedRole;
            this.assignee = assignee;
            this.status = status;
            this.dueDate = dueDate;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getAssignedRole() { return assignedRole; }
        public void setAssignedRole(String assignedRole) { this.assignedRole = assignedRole; }
        public String getAssignee() { return assignee; }
        public void setAssignee(String assignee) { this.assignee = assignee; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getDueDate() { return dueDate; }
        public void setDueDate(String dueDate) { this.dueDate = dueDate; }
    }

    public static class RelatedCaseDto {
        private String caseId;
        private String lcReference;
        private String relationship;
        private String processType;
        private String amountFormatted;
        private String status;

        public RelatedCaseDto() {
        }

        public RelatedCaseDto(String caseId, String lcReference, String relationship, String processType, String amountFormatted, String status) {
            this.caseId = caseId;
            this.lcReference = lcReference;
            this.relationship = relationship;
            this.processType = processType;
            this.amountFormatted = amountFormatted;
            this.status = status;
        }

        public String getCaseId() { return caseId; }
        public void setCaseId(String caseId) { this.caseId = caseId; }
        public String getLcReference() { return lcReference; }
        public void setLcReference(String lcReference) { this.lcReference = lcReference; }
        public String getRelationship() { return relationship; }
        public void setRelationship(String relationship) { this.relationship = relationship; }
        public String getProcessType() { return processType; }
        public void setProcessType(String processType) { this.processType = processType; }
        public String getAmountFormatted() { return amountFormatted; }
        public void setAmountFormatted(String amountFormatted) { this.amountFormatted = amountFormatted; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    public static class AuditEntryDto {
        private String id;
        private String timestamp;
        private String actor;
        private String role;
        private String event;
        private String details;
        private String source;

        public AuditEntryDto() {
        }

        public AuditEntryDto(String id, String timestamp, String actor, String role, String event, String details, String source) {
            this.id = id;
            this.timestamp = timestamp;
            this.actor = actor;
            this.role = role;
            this.event = event;
            this.details = details;
            this.source = source;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
        public String getActor() { return actor; }
        public void setActor(String actor) { this.actor = actor; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getEvent() { return event; }
        public void setEvent(String event) { this.event = event; }
        public String getDetails() { return details; }
        public void setDetails(String details) { this.details = details; }
        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }
    }

    public static class WorkItemDto {
        private String wid;
        private String wobNum;
        private String caseId;
        private String lcReference;
        private String inBasketId;
        private String processType;
        private String subject;
        private String applicantName;
        private String beneficiaryName;
        private String issuingBank;
        private String advisingBank;
        private String currency;
        private double amount;
        private String amountFormatted;
        private String expiryDate;
        private String latestShipmentDate;
        private String incoterms;
        private String tenor;
        private String stepName;
        private String caseMode;
        private String priority;
        private String assignedTo;
        private String makerName;
        private String checkerName;
        private String region;
        private String branchCode;
        private String sanctionsStatus;
        private int slaRemainingMinutes;
        private String slaLabel;
        private String createdAt;
        private String enteredQueueAt;
        private double ageingDays;
        private String ageingLabel;
        private String inQueueLabel;
        private String status;
        private int linkedCasesCount;
        private List<String> stepOutcomes;
        private List<WorkflowStageDto> stages;
        private List<CaseFieldDto> fields;
        private List<IcmDocumentDto> documents;
        private List<CommentDto> comments;
        private List<TaskDto> tasks;
        private List<RelatedCaseDto> relatedCases;
        private List<AuditEntryDto> auditTrail;

        public WorkItemDto() {
        }

        public String getWid() { return wid; }
        public void setWid(String wid) { this.wid = wid; }
        public String getWobNum() { return wobNum; }
        public void setWobNum(String wobNum) { this.wobNum = wobNum; }
        public String getCaseId() { return caseId; }
        public void setCaseId(String caseId) { this.caseId = caseId; }
        public String getLcReference() { return lcReference; }
        public void setLcReference(String lcReference) { this.lcReference = lcReference; }
        public String getInBasketId() { return inBasketId; }
        public void setInBasketId(String inBasketId) { this.inBasketId = inBasketId; }
        public String getProcessType() { return processType; }
        public void setProcessType(String processType) { this.processType = processType; }
        public String getSubject() { return subject; }
        public void setSubject(String subject) { this.subject = subject; }
        public String getApplicantName() { return applicantName; }
        public void setApplicantName(String applicantName) { this.applicantName = applicantName; }
        public String getBeneficiaryName() { return beneficiaryName; }
        public void setBeneficiaryName(String beneficiaryName) { this.beneficiaryName = beneficiaryName; }
        public String getIssuingBank() { return issuingBank; }
        public void setIssuingBank(String issuingBank) { this.issuingBank = issuingBank; }
        public String getAdvisingBank() { return advisingBank; }
        public void setAdvisingBank(String advisingBank) { this.advisingBank = advisingBank; }
        public String getCurrency() { return currency; }
        public void setCurrency(String currency) { this.currency = currency; }
        public double getAmount() { return amount; }
        public void setAmount(double amount) { this.amount = amount; }
        public String getAmountFormatted() { return amountFormatted; }
        public void setAmountFormatted(String amountFormatted) { this.amountFormatted = amountFormatted; }
        public String getExpiryDate() { return expiryDate; }
        public void setExpiryDate(String expiryDate) { this.expiryDate = expiryDate; }
        public String getLatestShipmentDate() { return latestShipmentDate; }
        public void setLatestShipmentDate(String latestShipmentDate) { this.latestShipmentDate = latestShipmentDate; }
        public String getIncoterms() { return incoterms; }
        public void setIncoterms(String incoterms) { this.incoterms = incoterms; }
        public String getTenor() { return tenor; }
        public void setTenor(String tenor) { this.tenor = tenor; }
        public String getStepName() { return stepName; }
        public void setStepName(String stepName) { this.stepName = stepName; }
        public String getCaseMode() { return caseMode; }
        public void setCaseMode(String caseMode) { this.caseMode = caseMode; }
        public String getPriority() { return priority; }
        public void setPriority(String priority) { this.priority = priority; }
        public String getAssignedTo() { return assignedTo; }
        public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }
        public String getMakerName() { return makerName; }
        public void setMakerName(String makerName) { this.makerName = makerName; }
        public String getCheckerName() { return checkerName; }
        public void setCheckerName(String checkerName) { this.checkerName = checkerName; }
        public String getRegion() { return region; }
        public void setRegion(String region) { this.region = region; }
        public String getBranchCode() { return branchCode; }
        public void setBranchCode(String branchCode) { this.branchCode = branchCode; }
        public String getSanctionsStatus() { return sanctionsStatus; }
        public void setSanctionsStatus(String sanctionsStatus) { this.sanctionsStatus = sanctionsStatus; }
        public int getSlaRemainingMinutes() { return slaRemainingMinutes; }
        public void setSlaRemainingMinutes(int slaRemainingMinutes) { this.slaRemainingMinutes = slaRemainingMinutes; }
        public String getSlaLabel() { return slaLabel; }
        public void setSlaLabel(String slaLabel) { this.slaLabel = slaLabel; }
        public String getCreatedAt() { return createdAt; }
        public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
        public String getEnteredQueueAt() { return enteredQueueAt; }
        public void setEnteredQueueAt(String enteredQueueAt) { this.enteredQueueAt = enteredQueueAt; }
        public double getAgeingDays() { return ageingDays; }
        public void setAgeingDays(double ageingDays) { this.ageingDays = ageingDays; }
        public String getAgeingLabel() { return ageingLabel; }
        public void setAgeingLabel(String ageingLabel) { this.ageingLabel = ageingLabel; }
        public String getInQueueLabel() { return inQueueLabel; }
        public void setInQueueLabel(String inQueueLabel) { this.inQueueLabel = inQueueLabel; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public int getLinkedCasesCount() { return linkedCasesCount; }
        public void setLinkedCasesCount(int linkedCasesCount) { this.linkedCasesCount = linkedCasesCount; }
        public List<String> getStepOutcomes() { return stepOutcomes; }
        public void setStepOutcomes(List<String> stepOutcomes) { this.stepOutcomes = stepOutcomes; }
        public List<WorkflowStageDto> getStages() { return stages; }
        public void setStages(List<WorkflowStageDto> stages) { this.stages = stages; }
        public List<CaseFieldDto> getFields() { return fields; }
        public void setFields(List<CaseFieldDto> fields) { this.fields = fields; }
        public List<IcmDocumentDto> getDocuments() { return documents; }
        public void setDocuments(List<IcmDocumentDto> documents) { this.documents = documents; }
        public List<CommentDto> getComments() { return comments; }
        public void setComments(List<CommentDto> comments) { this.comments = comments; }
        public List<TaskDto> getTasks() { return tasks; }
        public void setTasks(List<TaskDto> tasks) { this.tasks = tasks; }
        public List<RelatedCaseDto> getRelatedCases() { return relatedCases; }
        public void setRelatedCases(List<RelatedCaseDto> relatedCases) { this.relatedCases = relatedCases; }
        public List<AuditEntryDto> getAuditTrail() { return auditTrail; }
        public void setAuditTrail(List<AuditEntryDto> auditTrail) { this.auditTrail = auditTrail; }
    }

    public static class IntakeFieldConfigDto {
        private String key;
        private String label;
        private String type; // string, select, number, date
        private boolean required;
        private String source; // ICM or CUSTOM_DB
        private String symbolicName;
        private String dbColumn;
        private List<String> options;
        private String placeholder;

        public IntakeFieldConfigDto() {
        }

        public IntakeFieldConfigDto(
                String key, String label, String type, boolean required, String source,
                String symbolicName, String dbColumn, List<String> options, String placeholder) {
            this.key = key;
            this.label = label;
            this.type = type;
            this.required = required;
            this.source = source;
            this.symbolicName = symbolicName;
            this.dbColumn = dbColumn;
            this.options = options;
            this.placeholder = placeholder;
        }

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public boolean isRequired() { return required; }
        public void setRequired(boolean required) { this.required = required; }
        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }
        public String getSymbolicName() { return symbolicName; }
        public void setSymbolicName(String symbolicName) { this.symbolicName = symbolicName; }
        public String getDbColumn() { return dbColumn; }
        public void setDbColumn(String dbColumn) { this.dbColumn = dbColumn; }
        public List<String> getOptions() { return options; }
        public void setOptions(List<String> options) { this.options = options; }
        public String getPlaceholder() { return placeholder; }
        public void setPlaceholder(String placeholder) { this.placeholder = placeholder; }
    }

    public static class IntakeRoleConfigDto {
        private String roleName;
        private String inBasketId;
        private String stepName;
        private String defaultAssignee;
        private String caseType;
        private int widDigits;

        public IntakeRoleConfigDto() {
        }

        public IntakeRoleConfigDto(
                String roleName, String inBasketId, String stepName,
                String defaultAssignee, String caseType, int widDigits) {
            this.roleName = roleName;
            this.inBasketId = inBasketId;
            this.stepName = stepName;
            this.defaultAssignee = defaultAssignee;
            this.caseType = caseType;
            this.widDigits = widDigits;
        }

        public String getRoleName() { return roleName; }
        public void setRoleName(String roleName) { this.roleName = roleName; }
        public String getInBasketId() { return inBasketId; }
        public void setInBasketId(String inBasketId) { this.inBasketId = inBasketId; }
        public String getStepName() { return stepName; }
        public void setStepName(String stepName) { this.stepName = stepName; }
        public String getDefaultAssignee() { return defaultAssignee; }
        public void setDefaultAssignee(String defaultAssignee) { this.defaultAssignee = defaultAssignee; }
        public String getCaseType() { return caseType; }
        public void setCaseType(String caseType) { this.caseType = caseType; }
        public int getWidDigits() { return widDigits; }
        public void setWidDigits(int widDigits) { this.widDigits = widDigits; }
    }

    public static class IntakeConfigResponse {
        private IntakeRoleConfigDto roleConfig;
        private String generatedWid;
        private List<String> documentClasses;
        private List<IntakeFieldConfigDto> fields;

        public IntakeConfigResponse() {
        }

        public IntakeConfigResponse(
                IntakeRoleConfigDto roleConfig, String generatedWid,
                List<String> documentClasses, List<IntakeFieldConfigDto> fields) {
            this.roleConfig = roleConfig;
            this.generatedWid = generatedWid;
            this.documentClasses = documentClasses;
            this.fields = fields;
        }

        public IntakeRoleConfigDto getRoleConfig() { return roleConfig; }
        public void setRoleConfig(IntakeRoleConfigDto roleConfig) { this.roleConfig = roleConfig; }
        public String getGeneratedWid() { return generatedWid; }
        public void setGeneratedWid(String generatedWid) { this.generatedWid = generatedWid; }
        public List<String> getDocumentClasses() { return documentClasses; }
        public void setDocumentClasses(List<String> documentClasses) { this.documentClasses = documentClasses; }
        public List<IntakeFieldConfigDto> getFields() { return fields; }
        public void setFields(List<IntakeFieldConfigDto> fields) { this.fields = fields; }
    }

    public static class UploadedDocumentDto {
        private String fileName;
        private String mimeType;
        private long sizeBytes;
        private String docClass;
        private String contentDataUrl;
        private String textPreview;

        public UploadedDocumentDto() {
        }

        public UploadedDocumentDto(
                String fileName, String mimeType, long sizeBytes,
                String docClass, String contentDataUrl, String textPreview) {
            this.fileName = fileName;
            this.mimeType = mimeType;
            this.sizeBytes = sizeBytes;
            this.docClass = docClass;
            this.contentDataUrl = contentDataUrl;
            this.textPreview = textPreview;
        }

        public String getFileName() { return fileName; }
        public void setFileName(String fileName) { this.fileName = fileName; }
        public String getMimeType() { return mimeType; }
        public void setMimeType(String mimeType) { this.mimeType = mimeType; }
        public long getSizeBytes() { return sizeBytes; }
        public void setSizeBytes(long sizeBytes) { this.sizeBytes = sizeBytes; }
        public String getDocClass() { return docClass; }
        public void setDocClass(String docClass) { this.docClass = docClass; }
        public String getContentDataUrl() { return contentDataUrl; }
        public void setContentDataUrl(String contentDataUrl) { this.contentDataUrl = contentDataUrl; }
        public String getTextPreview() { return textPreview; }
        public void setTextPreview(String textPreview) { this.textPreview = textPreview; }
    }

    public record CreateCaseRequest(
        String wid,
        Map<String, String> fields,
        List<UploadedDocumentDto> documents,
        String actor
    ) {}

    public record SaveFieldsRequest(Map<String, String> fieldValues, String actor) {}

    public record CompleteStepRequest(
        String outcome,
        String reason,
        Map<String, String> fieldValues,
        String actor
    ) {}

    public record ReassignRequest(String targetUser, String actor) {}

    public record DocumentStatusRequest(String verificationStatus, String discrepancyNote, String actor) {}

    public record CommentRequest(String message, String actor, String role) {}

    public record CompleteStepResponse(String completedWobNum, WorkItemDto updatedItem, WorkItemDto nextWorkItem) {}
}
