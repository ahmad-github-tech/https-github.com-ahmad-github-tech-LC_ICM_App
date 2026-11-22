-- Reference MySQL Schema (auto-created/updated by Hibernate JPA ddl-auto=update)
CREATE DATABASE IF NOT EXISTS tradefinance_icm_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tradefinance_icm_db;

CREATE TABLE IF NOT EXISTS tf_lc_custom_fields (
    id BIGINT NOT NULL AUTO_INCREMENT,
    case_id VARCHAR(64) NOT NULL,
    lc_reference VARCHAR(64) NOT NULL,
    field_key VARCHAR(80) NOT NULL,
    db_column_name VARCHAR(80),
    field_value VARCHAR(4000),
    updated_by VARCHAR(100),
    updated_at DATETIME(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_case_field_key (case_id, field_key),
    INDEX idx_lc_reference (lc_reference)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tf_lc_case_intake (
    id BIGINT NOT NULL AUTO_INCREMENT,
    wid VARCHAR(6) NOT NULL,
    case_id VARCHAR(64) NOT NULL,
    wob_num VARCHAR(64) NOT NULL,
    lc_reference VARCHAR(64) NOT NULL,
    operation_type VARCHAR(120) NOT NULL,
    applicant_name VARCHAR(255) NOT NULL,
    beneficiary_name VARCHAR(255),
    sol_id VARCHAR(40) NOT NULL,
    customer_id VARCHAR(80),
    target_role VARCHAR(80) NOT NULL,
    target_inbasket_id VARCHAR(80) NOT NULL,
    document_count INT NOT NULL DEFAULT 0,
    created_by VARCHAR(100) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_intake_wid (wid),
    UNIQUE KEY uk_intake_case_id (case_id),
    INDEX idx_intake_sol (sol_id)
) ENGINE=InnoDB;
