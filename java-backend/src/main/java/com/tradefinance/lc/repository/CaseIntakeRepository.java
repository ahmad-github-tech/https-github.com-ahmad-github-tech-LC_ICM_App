package com.tradefinance.lc.repository;

import com.tradefinance.lc.model.CaseIntakeRecord;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CaseIntakeRepository extends JpaRepository<CaseIntakeRecord, Long> {

    boolean existsByWid(String wid);

    CaseIntakeRecord findByCaseId(String caseId);

    CaseIntakeRecord findByWid(String wid);
}
