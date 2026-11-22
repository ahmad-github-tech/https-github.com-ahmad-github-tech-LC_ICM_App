package com.tradefinance.lc.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Strongly-typed configuration properties for Custom Trade DB operations & WID generation.
 * JDBC datasource settings live under spring.datasource.* in application.properties.
 */
@Configuration
@ConfigurationProperties(prefix = "customdb")
public class CustomDbProperties {

    /** Logical MySQL schema name */
    private String schemaName = "tradefinance_icm_db";

    /** Auto-generated Work Intake ID numeric length (default 6 digits) */
    private int widDigits = 6;

    /** Optional prefix for WID display (empty keeps strictly 6 numeric digits) */
    private String widPrefix = "";

    /** Persist custom DB audit rows on intake & field updates */
    private boolean auditEnabled = true;

    public String getSchemaName() {
        return schemaName;
    }

    public void setSchemaName(String schemaName) {
        this.schemaName = schemaName;
    }

    public int getWidDigits() {
        return widDigits;
    }

    public void setWidDigits(int widDigits) {
        this.widDigits = widDigits;
    }

    public String getWidPrefix() {
        return widPrefix;
    }

    public void setWidPrefix(String widPrefix) {
        this.widPrefix = widPrefix;
    }

    public boolean isAuditEnabled() {
        return auditEnabled;
    }

    public void setAuditEnabled(boolean auditEnabled) {
        this.auditEnabled = auditEnabled;
    }
}
