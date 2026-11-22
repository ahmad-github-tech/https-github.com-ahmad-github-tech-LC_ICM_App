package com.tradefinance.lc.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Custom DB Entity persisting auto-generated 6-digit Work Intake ID (WID)
 * and initial case creation audit header in MySQL (tf_lc_case_intake).
 */
@Entity
@Table(name = "tf_lc_case_intake")
public class CaseIntakeRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "wid", nullable = false, unique = true, length = 6)
    private String wid;

    @Column(name = "case_id", nullable = false, unique = true, length = 64)
    private String caseId;

    @Column(name = "wob_num", nullable = false, length = 64)
    private String wobNum;

    @Column(name = "lc_reference", nullable = false, length = 64)
    private String lcReference;

    @Column(name = "operation_type", nullable = false, length = 120)
    private String operationType;

    @Column(name = "applicant_name", nullable = false, length = 255)
    private String applicantName;

    @Column(name = "beneficiary_name", length = 255)
    private String beneficiaryName;

    @Column(name = "sol_id", nullable = false, length = 40)
    private String solId;

    @Column(name = "customer_id", length = 80)
    private String customerId;

    @Column(name = "target_role", nullable = false, length = 80)
    private String targetRole;

    @Column(name = "target_inbasket_id", nullable = false, length = 80)
    private String targetInBasketId;

    @Column(name = "document_count", nullable = false)
    private int documentCount;

    @Column(name = "created_by", nullable = false, length = 100)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public CaseIntakeRecord() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getWid() {
        return wid;
    }

    public void setWid(String wid) {
        this.wid = wid;
    }

    public String getCaseId() {
        return caseId;
    }

    public void setCaseId(String caseId) {
        this.caseId = caseId;
    }

    public String getWobNum() {
        return wobNum;
    }

    public void setWobNum(String wobNum) {
        this.wobNum = wobNum;
    }

    public String getLcReference() {
        return lcReference;
    }

    public void setLcReference(String lcReference) {
        this.lcReference = lcReference;
    }

    public String getOperationType() {
        return operationType;
    }

    public void setOperationType(String operationType) {
        this.operationType = operationType;
    }

    public String getApplicantName() {
        return applicantName;
    }

    public void setApplicantName(String applicantName) {
        this.applicantName = applicantName;
    }

    public String getBeneficiaryName() {
        return beneficiaryName;
    }

    public void setBeneficiaryName(String beneficiaryName) {
        this.beneficiaryName = beneficiaryName;
    }

    public String getSolId() {
        return solId;
    }

    public void setSolId(String solId) {
        this.solId = solId;
    }

    public String getCustomerId() {
        return customerId;
    }

    public void setCustomerId(String customerId) {
        this.customerId = customerId;
    }

    public String getTargetRole() {
        return targetRole;
    }

    public void setTargetRole(String targetRole) {
        this.targetRole = targetRole;
    }

    public String getTargetInBasketId() {
        return targetInBasketId;
    }

    public void setTargetInBasketId(String targetInBasketId) {
        this.targetInBasketId = targetInBasketId;
    }

    public int getDocumentCount() {
        return documentCount;
    }

    public void setDocumentCount(int documentCount) {
        this.documentCount = documentCount;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
