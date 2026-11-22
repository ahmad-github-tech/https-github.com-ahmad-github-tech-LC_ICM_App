package com.tradefinance.lc.service;

import com.tradefinance.lc.config.CustomDbProperties;
import com.tradefinance.lc.dto.IcmDtos.CaseFieldDto;
import com.tradefinance.lc.dto.IcmDtos.IntakeFieldConfigDto;
import com.tradefinance.lc.dto.IcmDtos.IntakeRoleConfigDto;
import com.tradefinance.lc.model.CaseIntakeRecord;
import com.tradefinance.lc.model.CustomLcFieldValue;
import com.tradefinance.lc.repository.CaseIntakeRepository;
import com.tradefinance.lc.repository.CustomLcFieldRepository;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Separate Custom Business & Database Service (MySQL JPA).
 * Owns:
 *  - Auto-generation and uniqueness verification of the 6-digit Work Intake ID (WID)
 *  - Persistence of WID intake header into tf_lc_case_intake
 *  - Persistence and hydration of CUSTOM_DB case fields in tf_lc_custom_fields
 *
 * Intentionally decoupled from IBM Case Manager and FileNet Content Engine APIs.
 */
@Service
public class CustomIntakeService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final CustomDbProperties customDbProps;
    private final CaseIntakeRepository caseIntakeRepository;
    private final CustomLcFieldRepository customFieldRepository;

    public CustomIntakeService(
            CustomDbProperties customDbProps,
            CaseIntakeRepository caseIntakeRepository,
            CustomLcFieldRepository customFieldRepository) {
        this.customDbProps = customDbProps;
        this.caseIntakeRepository = caseIntakeRepository;
        this.customFieldRepository = customFieldRepository;
    }

    /**
     * Generates a unique numeric WID of the configured digit length (default 6 digits: 100000-999999).
     */
    public String generateUniqueWid(int digits) {
        int resolved = digits > 0 ? digits : customDbProps.getWidDigits();
        int safeDigits = Math.max(4, Math.min(9, resolved));
        int min = (int) Math.pow(10, safeDigits - 1);
        int bound = (int) Math.pow(10, safeDigits) - min;

        for (int attempt = 0; attempt < 25; attempt++) {
            String candidate = String.valueOf(min + RANDOM.nextInt(bound));
            if (!caseIntakeRepository.existsByWid(candidate)) {
                return candidate;
            }
        }
        return String.valueOf(min + (int) (System.currentTimeMillis() % bound));
    }

    /**
     * Validates or allocates the 6-digit WID passed from intake before persisting and forwarding to ICM CaseCreation.
     */
    public String resolveOrValidateWid(String requestedWid, int digits) {
        String regex = "\\d{" + Math.max(4, Math.min(9, digits)) + "}";
        if (requestedWid != null && requestedWid.matches(regex) && !caseIntakeRepository.existsByWid(requestedWid)) {
            return requestedWid;
        }
        return generateUniqueWid(digits);
    }

    @Transactional
    public CaseIntakeRecord persistIntakeAndCustomFields(
            String wid,
            String caseId,
            String wobNum,
            String lcReference,
            IntakeRoleConfigDto roleConfig,
            List<IntakeFieldConfigDto> schemaFields,
            Map<String, String> submittedValues,
            int documentCount,
            String actor) {

        CaseIntakeRecord record = new CaseIntakeRecord();
        record.setWid(wid);
        record.setCaseId(caseId);
        record.setWobNum(wobNum);
        record.setLcReference(lcReference);
        record.setOperationType(Objects.toString(submittedValues.get("LC_Operation_Type"), "Import LC Issuance"));
        record.setApplicantName(Objects.toString(submittedValues.get("LC_Applicant_Name"), ""));
        record.setBeneficiaryName(submittedValues.get("LC_Beneficiary_Name"));
        record.setSolId(Objects.toString(submittedValues.get("LC_SOL_ID"), ""));
        record.setCustomerId(submittedValues.get("LC_Customer_ID"));
        record.setTargetRole(roleConfig.getRoleName());
        record.setTargetInBasketId(roleConfig.getInBasketId());
        record.setDocumentCount(documentCount);
        record.setCreatedBy(actor);
        record.setCreatedAt(Instant.now());
        CaseIntakeRecord saved = caseIntakeRepository.save(record);

        // Persist the auto-generated WID + every CUSTOM_DB configured field into tf_lc_custom_fields
        persistCustomDbField(caseId, lcReference, "lcWid", "lc_wid", wid, actor);
        for (IntakeFieldConfigDto fieldCfg : schemaFields) {
            if ("CUSTOM_DB".equalsIgnoreCase(fieldCfg.getSource())) {
                String val = Objects.toString(submittedValues.get(fieldCfg.getKey()), "");
                String col = fieldCfg.getDbColumn() != null ? fieldCfg.getDbColumn() : fieldCfg.getKey().toLowerCase();
                persistCustomDbField(caseId, lcReference, fieldCfg.getKey(), col, val, actor);
            }
        }
        return saved;
    }

    @Transactional
    public void persistCustomDbField(
            String caseId, String lcRef, String fieldKey, String columnName, String value, String actor) {
        CustomLcFieldValue entity = customFieldRepository
                .findByCaseIdAndFieldKey(caseId, fieldKey)
                .orElseGet(CustomLcFieldValue::new);
        entity.setCaseId(caseId);
        entity.setLcReference(lcRef);
        entity.setFieldKey(fieldKey);
        entity.setDbColumnName(columnName);
        entity.setFieldValue(value);
        entity.setUpdatedBy(actor);
        entity.setUpdatedAt(Instant.now());
        customFieldRepository.save(entity);
    }

    public Map<String, String> loadCustomDbFieldMap(String caseId) {
        List<CustomLcFieldValue> dbValues = customFieldRepository.findByCaseId(caseId);
        Map<String, String> dbMap = new HashMap<>();
        for (CustomLcFieldValue val : dbValues) {
            dbMap.put(val.getFieldKey(), val.getFieldValue());
        }
        return dbMap;
    }

    public void hydrateCustomFields(String caseId, List<CaseFieldDto> fields) {
        Map<String, String> dbMap = loadCustomDbFieldMap(caseId);
        for (CaseFieldDto field : fields) {
            if ("CUSTOM_DB".equals(field.getSource()) && dbMap.containsKey(field.getKey())) {
                field.setValue(dbMap.get(field.getKey()));
            }
        }
    }
}
