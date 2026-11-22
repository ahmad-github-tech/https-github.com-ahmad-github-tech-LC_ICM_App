package com.tradefinance.lc.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Strongly-typed configuration properties for IBM Case Manager (ICM) & Process Engine.
 * Populated from icm.* properties in application.properties / environment variables.
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "icm")
public class IcmProperties {

    /** SIMULATED or LIVE_FILENET */
    private String mode = "SIMULATED";

    /** Business Automation Navigator / ICM Portal base URL */
    private String url;

    /** IBM Case Manager CASEREST API base URL */
    private String restUrl;

    /** ICM / Navigator service user */
    private String user;

    /** ICM / Navigator service password (override via ICM_PASSWORD env var) */
    private String password;

    /** Navigator Desktop ID */
    private String desktopId = "TradeFinanceDesktop";

    /** Process Engine Connection Point name */
    private String connectionPoint;

    /** Process Engine isolated region number */
    private int peRegion = 1;

    /** ICM Solution Name */
    private String solutionName = "TradeFinanceLC";

    /** ICM Solution Symbolic Prefix */
    private String solutionPrefix = "TFLC";

    /** Default ICM Case Type symbolic name */
    private String caseType = "TFLC_ImportLCCase";

    private ViewerProperties viewer = new ViewerProperties();

    @Data
    public static class ViewerProperties {
        /** Daeja ViewONE / Navigator bookmark URL */
        private String daejaBaseUrl;
    }
}
