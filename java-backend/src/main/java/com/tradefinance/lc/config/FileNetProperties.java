package com.tradefinance.lc.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Strongly-typed configuration properties for IBM FileNet Content Engine (CE).
 * Populated from filenet.* properties in application.properties / environment variables.
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "filenet")
public class FileNetProperties {

    /** Content Engine Web Services (WSI) or EJB URI, e.g. https://host:9443/wsi/FNCEWS40MTOM/ */
    private String url;

    /** FileNet P8 service account username */
    private String user;

    /** FileNet P8 service account password (override via FILENET_PASSWORD env var) */
    private String password;

    /** JAAS configuration stanza (FileNetP8WSI or FileNetP8) */
    private String stanza = "FileNetP8WSI";

    /** FileNet P8 Domain name */
    private String domain;

    /** Target Object Store symbolic name where Cases & Documents reside */
    private String targetObjectStore;

    /** Design Object Store symbolic name */
    private String designObjectStore;

    /** Root folder path inside Target Object Store for filing Case documents */
    private String caseFolderRoot = "/TradeFinanceLC/Cases";

    /** Fallback CE Document Class symbolic name */
    private String defaultDocumentClass = "TF_LC_Document";

    /** Connection timeout in milliseconds */
    private int connectionTimeoutMs = 30000;
}
