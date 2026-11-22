package com.tradefinance.lc.dto;

import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public class IcmDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InBasketDto {
        private String id;
        private String name;
        private String roleName;
        private String description;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
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
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DocRowDto {
        private String label;
        private String value;
        private String highlightKey;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DocSectionDto {
        private String heading;
        private List<DocRowDto> rows;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
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
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkflowStageDto {
        private String id;
        private String label;
        private String status;
        private String completedBy;
        private String completedAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CommentDto {
        private String id;
        private String author;
        private String role;
        private String timestamp;
        private String message;
        private String actionType;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TaskDto {
        private String id;
        private String title;
        private String assignedRole;
        private String assignee;
        private String status;
        private String dueDate;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RelatedCaseDto {
        private String caseId;
        private String lcReference;
        private String relationship;
        private String processType;
        private String amountFormatted;
        private String status;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AuditEntryDto {
        private String id;
        private String timestamp;
        private String actor;
        private String role;
        private String event;
        private String details;
        private String source;
    }

    @Data
    @NoArgsConstructor
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
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
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
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IntakeRoleConfigDto {
        private String roleName;
        private String inBasketId;
        private String stepName;
        private String defaultAssignee;
        private String caseType;
        private int widDigits;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IntakeConfigResponse {
        private IntakeRoleConfigDto roleConfig;
        private String generatedWid;
        private List<String> documentClasses;
        private List<IntakeFieldConfigDto> fields;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UploadedDocumentDto {
        private String fileName;
        private String mimeType;
        private long sizeBytes;
        private String docClass;
        private String contentDataUrl;
        private String textPreview;
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
