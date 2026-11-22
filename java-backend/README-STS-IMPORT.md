# Importing & Running `/java-backend` Directly in Eclipse Kepler SR1 (JDK 1.7) & IBM WAS (Java 8)

This folder (`java-backend/`) is built for **zero-friction compatibility** with your exact server stack:
- **JDK 1.7 (`1.7`)** source/target (100% compatible with **Eclipse Kepler Service Release 1** — zero lambdas/streams/`java.time`, zero Lombok IDE plugin required)
- **Spring Boot `1.5.22.RELEASE`** (`<packaging>war</packaging>` — runs inside Eclipse Kepler on JDK 1.7 **and** deploys cleanly as a `.war` onto **IBM WAS running on Java 8**)
- **MySQL Custom DB** (`mysql-connector-java` + Hibernate JPA auto table creation `tf_lc_custom_fields`, `tf_lc_case_intake`)
- **Clean Service Separation**:
  - `FileNetSessionManager` + `FileNetDocumentService` (FileNet P8 CE & Case Folder Filing)
  - `IcmCaseCreationService` (IBM Case Manager `CaseType`, `CaseCreation` with 6-digit `WID`, & PE workflow)
  - `CustomIntakeService` (Custom DB persistence & 6-digit `WID` generation)
  - `IntakeConfigPropertiesService` (Reads role & intake field schema from `case-intake.properties`)

## 1. Direct Download from AI Studio -> Import Directly into Eclipse Kepler (No STS / Git Needed)
1. Download the project ZIP directly from **Google AI Studio** and extract it to a folder on your machine/server (for example `C:\Projects\meridian-lc\`).
2. Open **Eclipse Kepler SR1** (`File -> Import -> Maven -> Existing Maven Projects`).
3. Browse to the extracted **`java-backend`** subfolder (`C:\Projects\meridian-lc\java-backend`) and click **Finish**.
4. Right-click `meridian-lc-casemanager-services` -> **Maven -> Update Project...** (`Alt+F5`).
5. Under **Project -> Properties -> Java Build Path -> Libraries**, attach `acmapi.jar`, `Jace.jar`, `pe.jar`, `pe3pt.jar`, and `peResources.jar` when enabling live IBM FileNet/ICM classes. (Do **not** add `log4.jar` / `log4j-1.2.14.jar` unless explicitly needed.)

## 2. Configure MySQL, FileNet P8 & IBM Case Manager (`application.properties`)
All connection parameters in `src/main/resources/application.properties` bind to `@ConfigurationProperties` beans (`CustomDbProperties`, `FileNetProperties`, `IcmProperties`) and support OS / WebSphere JVM environment variables:

- **Custom DB (`spring.datasource.*` & `customdb.*`)**:
  - `CUSTOM_DB_URL`, `CUSTOM_DB_USER`, `CUSTOM_DB_PASSWORD`, `CUSTOM_DB_SCHEMA`, `CUSTOM_WID_DIGITS=6`
- **FileNet P8 Content Engine (`filenet.*`)**:
  - `FILENET_URL`, `FILENET_USER`, `FILENET_PASSWORD`, `FILENET_STANZA` (`FileNetP8WSI`), `FILENET_DOMAIN`, `FILENET_TARGET_OS`, `FILENET_DESIGN_OS`, `FILENET_CASE_FOLDER_ROOT`, `FILENET_DEFAULT_DOC_CLASS`
- **IBM Case Manager (`icm.*`)**:
  - `ICM_MODE` (`SIMULATED` or `LIVE_FILENET`), `ICM_URL`, `ICM_REST_URL`, `ICM_USER`, `ICM_PASSWORD`, `ICM_DESKTOP_ID`, `ICM_CONNECTION_POINT`, `ICM_PE_REGION`, `ICM_SOLUTION_NAME`, `ICM_SOLUTION_PREFIX`, `ICM_CASE_TYPE`, `ICM_DAEJA_URL`
- **Configurable Roles & Intake Attributes (`case-intake.properties`)**:
  - Edit `src/main/resources/case-intake.properties` (or override `intake.config.path=file:/opt/tradeflow/case-intake.properties`).

## 3. Deploy `.war` to IBM WebSphere Application Server (WAS on Java 8) or Run in Kepler
1. Build the WAR via Right-click project -> **Run As -> Maven install** (or `mvn clean package`) -> outputs `target/meridian-lc-casemanager-services.war`.
2. In **IBM WAS Admin Console**:
   - Install `meridian-lc-casemanager-services.war` with your context root (e.g. `/meridian-lc`).
   - Under **Enterprise Applications -> meridian-lc-casemanager-services -> Class loading and update detection**, set Class loader order to **Classes loaded with local class loader first (parent last)** so bundled Spring/Hibernate/Jackson libraries do not conflict with WAS runtime libraries.
3. For local Eclipse Kepler execution: Right-click `LcCaseManagerApplication.java` -> **Run As -> Java Application**.
4. Endpoints:
   - React REST API: `http://localhost:8080/api/icm/workitems` & `http://localhost:8080/api/icm/cases`
   - Configurable Intake Schema: `http://localhost:8080/api/icm/intake-config`
   - Thymeleaf Login: `http://localhost:8080/login`
   - Thymeleaf Queue Monitor: `http://localhost:8080/dashboard`

## 4. Connect React UI (`meridian-lc-casemanager-ui`)
From the root folder of the downloaded ZIP:
- Run `npm install && npm run dev` (set `VITE_API_BASE_URL=http://localhost:8080/api/icm` in `.env`), **or**
- Run `npm run build` and copy `dist/*` into `java-backend/src/main/resources/static/` so the single `.war` on IBM WAS serves both the React UI and Spring Boot APIs.
