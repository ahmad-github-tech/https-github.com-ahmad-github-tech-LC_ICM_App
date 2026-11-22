package com.tradefinance.lc.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Persists Letter of Credit extended attributes stored in MySQL Custom Trade DB
 * (as opposed to core properties stored inside IBM Case Manager ObjectStore).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
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
}
