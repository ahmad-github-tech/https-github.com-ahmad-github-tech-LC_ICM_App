package com.tradefinance.lc.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * Persists Letter of Credit extended attributes stored in MySQL Custom Trade DB
 * (as opposed to core properties stored inside IBM Case Manager ObjectStore).
 */
@Entity
@Table(
    name = "tf_lc_custom_fields",
    uniqueConstraints = @UniqueConstraint(columnNames = {"case_id", "field_key"})
)
public class CustomLcFieldValue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id", nullable = false, length = 64)
    private String caseId;

    @Column(name = "lc_reference", nullable = false, length = 64)
    private String lcReference;

    @Column(name = "field_key", nullable = false, length = 80)
    private String fieldKey;

    @Column(name = "db_column_name", length = 80)
    private String dbColumnName;

    @Column(name = "field_value", length = 4000)
    private String fieldValue;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public CustomLcFieldValue() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCaseId() {
        return caseId;
    }

    public void setCaseId(String caseId) {
        this.caseId = caseId;
    }

    public String getLcReference() {
        return lcReference;
    }

    public void setLcReference(String lcReference) {
        this.lcReference = lcReference;
    }

    public String getFieldKey() {
        return fieldKey;
    }

    public void setFieldKey(String fieldKey) {
        this.fieldKey = fieldKey;
    }

    public String getDbColumnName() {
        return dbColumnName;
    }

    public void setDbColumnName(String dbColumnName) {
        this.dbColumnName = dbColumnName;
    }

    public String getFieldValue() {
        return fieldValue;
    }

    public void setFieldValue(String fieldValue) {
        this.fieldValue = fieldValue;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
