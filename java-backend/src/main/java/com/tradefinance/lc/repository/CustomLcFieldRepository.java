package com.tradefinance.lc.repository;

import com.tradefinance.lc.model.CustomLcFieldValue;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomLcFieldRepository extends JpaRepository<CustomLcFieldValue, Long> {
    List<CustomLcFieldValue> findByCaseId(String caseId);
    Optional<CustomLcFieldValue> findByCaseIdAndFieldKey(String caseId, String fieldKey);
}
