package com.tradefinance.lc.repository;

import com.tradefinance.lc.model.CaseIntakeRecord;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CaseIntakeRepository extends JpaRepository<CaseIntakeRecord, Long> {

    boolean existsByWid(String wid);

    Optional<CaseIntakeRecord> findByCaseId(String caseId);

    Optional<CaseIntakeRecord> findByWid(String wid);
}
