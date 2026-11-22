package com.tradefinance.lc.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Strongly-typed configuration properties for IBM Case Manager (ICM) & Process Engine.
 * Populated from icm.* properties in application.properties / environment variables.
 */
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

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getRestUrl() {
        return restUrl;
    }

    public void setRestUrl(String restUrl) {
        this.restUrl = restUrl;
    }

    public String getUser() {
        return user;
    }

    public void setUser(String user) {
        this.user = user;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getDesktopId() {
        return desktopId;
    }

    public void setDesktopId(String desktopId) {
        this.desktopId = desktopId;
    }

    public String getConnectionPoint() {
        return connectionPoint;
    }

    public void setConnectionPoint(String connectionPoint) {
        this.connectionPoint = connectionPoint;
    }

    public int getPeRegion() {
        return peRegion;
    }

    public void setPeRegion(int peRegion) {
        this.peRegion = peRegion;
    }

    public String getSolutionName() {
        return solutionName;
    }

    public void setSolutionName(String solutionName) {
        this.solutionName = solutionName;
    }

    public String getSolutionPrefix() {
        return solutionPrefix;
    }

    public void setSolutionPrefix(String solutionPrefix) {
        this.solutionPrefix = solutionPrefix;
    }

    public String getCaseType() {
        return caseType;
    }

    public void setCaseType(String caseType) {
        this.caseType = caseType;
    }

    public ViewerProperties getViewer() {
        return viewer;
    }

    public void setViewer(ViewerProperties viewer) {
        this.viewer = viewer;
    }

    public static class ViewerProperties {
        /** Daeja ViewONE / Navigator bookmark URL */
        private String daejaBaseUrl;

        public String getDaejaBaseUrl() {
            return daejaBaseUrl;
        }

        public void setDaejaBaseUrl(String daejaBaseUrl) {
            this.daejaBaseUrl = daejaBaseUrl;
        }
    }
}
