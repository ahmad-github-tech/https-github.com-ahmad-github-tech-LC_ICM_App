package com.tradefinance.lc.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Strongly-typed configuration properties for Custom Trade DB operations & WID generation.
 * JDBC datasource settings live under spring.datasource.* in application.properties.
 */
@Data
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
}
