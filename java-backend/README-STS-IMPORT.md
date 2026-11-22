# Importing & Running `/java-backend` in Spring Tool Suite (STS)

This folder (`java-backend/`) matches your enterprise Java stack:
- **Java 17** + **Maven** (`<packaging>war</packaging>` for Tomcat)
- **Spring Boot 3.2.5** (`web`, `thymeleaf`, `data-jpa`, `validation`, `lombok`)
- **MySQL Custom DB** with HikariCP pooling & JPA/Hibernate auto table creation (`tf_lc_custom_fields`, `tf_lc_case_intake`)
- **Clean Service Separation**:
  - `FileNetSessionManager` + `FileNetDocumentService` (FileNet P8 CE & Case Folder Filing)
  - `IcmCaseCreationService` (IBM Case Manager `CaseType`, `CaseCreation` with 6-digit `WID`, & PE workflow)
  - `CustomIntakeService` (Custom DB persistence & 6-digit `WID` generation)
  - `IntakeConfigPropertiesService` (Reads role & intake field schema from `case-intake.properties`)

## 1. Import into STS
1. Open **Spring Tool Suite (STS)**.
2. Click **File -> Import -> Maven -> Existing Maven Projects**.
3. Select the `java-backend/` folder and click **Finish**.
4. Ensure Lombok annotation processing is enabled in STS if needed.

## 2. Configure MySQL, FileNet P8 & IBM Case Manager (`application.properties`)
All connection parameters in `src/main/resources/application.properties` bind to strongly-typed `@ConfigurationProperties` beans (`CustomDbProperties`, `FileNetProperties`, `IcmProperties`) and support OS environment variables:

- **Custom DB (`spring.datasource.*` & `customdb.*`)**:
  - `CUSTOM_DB_URL`, `CUSTOM_DB_USER`, `CUSTOM_DB_PASSWORD`, `CUSTOM_DB_SCHEMA`, `CUSTOM_WID_DIGITS=6`
- **FileNet P8 Content Engine (`filenet.*`)**:
  - `FILENET_URL` (WSI/EJB URI), `FILENET_USER`, `FILENET_PASSWORD`, `FILENET_STANZA` (`FileNetP8WSI`), `FILENET_DOMAIN`, `FILENET_TARGET_OS`, `FILENET_DESIGN_OS`, `FILENET_CASE_FOLDER_ROOT`, `FILENET_DEFAULT_DOC_CLASS`
- **IBM Case Manager (`icm.*`)**:
  - `ICM_MODE` (`SIMULATED` or `LIVE_FILENET`), `ICM_URL` (Navigator URL), `ICM_REST_URL` (`CASEREST/v1`), `ICM_USER`, `ICM_PASSWORD`, `ICM_DESKTOP_ID`, `ICM_CONNECTION_POINT`, `ICM_PE_REGION`, `ICM_SOLUTION_NAME`, `ICM_SOLUTION_PREFIX`, `ICM_CASE_TYPE`, `ICM_DAEJA_URL`
- **Configurable Roles & Intake Attributes (`case-intake.properties`)**:
  - Edit `src/main/resources/case-intake.properties` (or override `intake.config.path=file:/opt/tradeflow/case-intake.properties`) to add/remove fields, toggle `required=true/false`, change `ICM` vs `CUSTOM_DB`, or change Maker role routing.

## 3. Run in STS / Deploy to Tomcat
1. Right-click `LcCaseManagerApplication.java` -> **Run As -> Spring Boot App** (or build `target/meridian-lc-casemanager-services.war` for Apache Tomcat).
2. Endpoints:
   - React REST API: `http://localhost:8080/api/icm/workitems` & `http://localhost:8080/api/icm/cases`
   - Configurable Intake Schema: `http://localhost:8080/api/icm/intake-config`
   - Thymeleaf Login: `http://localhost:8080/login`
   - Thymeleaf Queue Monitor: `http://localhost:8080/dashboard`

## 4. Connect React Frontend to STS
Set `VITE_API_BASE_URL=http://localhost:8080/api/icm` in `.env` and run `npm run dev`.

## 5. Enable Live IBM FileNet / ICM APIs
1. Place `Jace.jar`, `pe.jar`, `peResources.jar`, and your ICM Case API JAR in `java-backend/libs/` and uncomment them in `java-backend/pom.xml`.
2. Set `icm.mode=LIVE_FILENET` (or `ICM_MODE=LIVE_FILENET`) and supply valid `FILENET_*` and `ICM_*` credentials.
