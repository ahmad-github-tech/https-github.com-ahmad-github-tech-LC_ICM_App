package com.tradefinance.lc.service;

import com.tradefinance.lc.dto.IcmDtos.IntakeFieldConfigDto;
import com.tradefinance.lc.dto.IcmDtos.IntakeRoleConfigDto;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Properties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.core.io.support.PropertiesLoaderUtils;
import org.springframework.stereotype.Service;

/**
 * Loads Role routing and Case Creation attribute schemas dynamically from
 * case-intake.properties (or an external file configured via intake.config.path).
 * Changing field counts, mandatory/non-mandatory flags, types, or role targets
 * in the properties file requires zero code changes.
 */
@Service
public class IntakeConfigPropertiesService {

    private final ResourceLoader resourceLoader;

    @Value("${intake.config.path:classpath:case-intake.properties}")
    private String intakeConfigPath;

    public IntakeConfigPropertiesService(ResourceLoader resourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    public Properties loadRawProperties() {
        try {
            Resource resource = resourceLoader.getResource(intakeConfigPath);
            return PropertiesLoaderUtils.loadProperties(resource);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to load intake configuration: " + intakeConfigPath, ex);
        }
    }

    public IntakeRoleConfigDto getRoleConfig() {
        Properties props = loadRawProperties();
        return new IntakeRoleConfigDto(
                props.getProperty("intake.initial.roleName", "TF_LC_MAKER").trim(),
                props.getProperty("intake.initial.inBasketId", "lc-maker").trim(),
                props.getProperty("intake.initial.stepName", "LC Maker Draft & Verify").trim(),
                props.getProperty("intake.initial.assignee", "Priya Nair").trim(),
                props.getProperty("intake.initial.caseType", "TF_LC_Case").trim(),
                Integer.parseInt(props.getProperty("intake.wid.digits", "6").trim())
        );
    }

    public List<String> getDocumentClasses() {
        Properties props = loadRawProperties();
        return splitCsv(props.getProperty("intake.document.classes", "LC Application Form,Proforma Invoice"));
    }

    public List<IntakeFieldConfigDto> getIntakeFields() {
        Properties props = loadRawProperties();
        List<String> keys = splitCsv(props.getProperty("intake.fields.order", ""));
        List<IntakeFieldConfigDto> result = new ArrayList<>();

        for (String key : keys) {
            String prefix = "intake.field." + key + ".";
            String label = props.getProperty(prefix + "label", key).trim();
            String type = props.getProperty(prefix + "type", "string").trim();
            boolean required = Boolean.parseBoolean(props.getProperty(prefix + "required", "false").trim());
            String source = props.getProperty(prefix + "source", "ICM").trim();
            String symbolicName = props.getProperty(prefix + "symbolicName", key).trim();
            String dbColumn = props.getProperty(prefix + "dbColumn", "").trim();
            List<String> options = splitCsv(props.getProperty(prefix + "options", ""));
            String placeholder = props.getProperty(prefix + "placeholder", "").trim();

            result.add(new IntakeFieldConfigDto(
                    key,
                    label,
                    type,
                    required,
                    source,
                    symbolicName,
                    dbColumn.isEmpty() ? null : dbColumn,
                    options,
                    placeholder
            ));
        }
        return result;
    }

    private List<String> splitCsv(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return Collections.emptyList();
        }
        String[] parts = raw.split(",");
        List<String> items = new ArrayList<String>();
        for (String part : parts) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                items.add(trimmed);
            }
        }
        return items;
    }
}
