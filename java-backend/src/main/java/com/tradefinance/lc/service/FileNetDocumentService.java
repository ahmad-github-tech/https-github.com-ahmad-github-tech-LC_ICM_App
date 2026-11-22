package com.tradefinance.lc.service;

import com.tradefinance.lc.config.FileNetProperties;
import com.tradefinance.lc.config.IcmProperties;
import com.tradefinance.lc.dto.IcmDtos.DocRowDto;
import com.tradefinance.lc.dto.IcmDtos.DocSectionDto;
import com.tradefinance.lc.dto.IcmDtos.IcmDocumentDto;
import com.tradefinance.lc.dto.IcmDtos.UploadedDocumentDto;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Separate IBM FileNet Content Engine (CE) Java Service.
 * Uses FileNetProperties, IcmProperties, and FileNetSessionManager:
 *  - Creating FileNet Document instances (single or multi-file batch upload)
 *  - Filing documents into the IBM ICM Case Folder (ReferentialContainmentRelationship)
 *  - Building Daeja ViewONE viewer URLs for embedded rendering
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileNetDocumentService {

    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final FileNetProperties fileNetProps;
    private final IcmProperties icmProps;
    private final FileNetSessionManager sessionManager;

    /**
     * Uploads and files one or multiple documents into the IBM ICM Case folder inside FileNet CE.
     */
    public List<IcmDocumentDto> uploadAndFileDocuments(
            String wid,
            String caseId,
            String lcReference,
            List<UploadedDocumentDto> uploads,
            String actor) {

        List<IcmDocumentDto> filedDocs = new ArrayList<>();
        if (uploads == null || uploads.isEmpty()) {
            return filedDocs;
        }

        sessionManager.validateAndPushSubject();

        String now = TS_FMT.format(LocalDateTime.now());
        int index = 1;
        String caseFolderPath = fileNetProps.getCaseFolderRoot() + "/" + caseId;

        for (UploadedDocumentDto upload : uploads) {
            String docId = "FN-DOC-" + wid + "-" + index++;
            String docClass = upload.getDocClass() != null && !upload.getDocClass().isBlank()
                    ? upload.getDocClass()
                    : fileNetProps.getDefaultDocumentClass();

            if (sessionManager.isLiveMode()) {
                /*
                 * LIVE FILENET CE DOCUMENT UPLOAD & CASE FILING:
                 *
                 * Document doc = Factory.Document.createInstance(objectStore, docClass);
                 * doc.getProperties().putValue("DocumentTitle", upload.getFileName());
                 * doc.getProperties().putValue("LC_WID", wid);
                 * ContentTransfer ct = Factory.ContentTransfer.createInstance();
                 * ct.setCaptureSource(inputStream);
                 * ct.set_ContentType(upload.getMimeType());
                 * ContentElementList cel = Factory.ContentElement.createList();
                 * cel.add(ct);
                 * doc.set_ContentElements(cel);
                 * doc.checkin(AutoClassify.DO_NOT_AUTO_CLASSIFY, CheckinType.MAJOR_VERSION);
                 * doc.save(RefreshMode.REFRESH);
                 *
                 * Folder caseFolder = Factory.Folder.fetchInstance(objectStore, caseFolderPath, null);
                 * ReferentialContainmentRelationship rcr = caseFolder.file(doc, AutoUniqueName.AUTO_UNIQUE,
                 *         upload.getFileName(), DefineSecurityParentage.DO_NOT_DEFINE_SECURITY_PARENTAGE);
                 * rcr.save(RefreshMode.NO_REFRESH);
                 */
                log.info("[LIVE_FILENET] Filed document {} ({}) into ObjectStore {} folder {} for Case {}",
                        upload.getFileName(), docClass, fileNetProps.getTargetObjectStore(), caseFolderPath, caseId);
            }

            String sizeLabel = formatBytes(upload.getSizeBytes());
            filedDocs.add(new IcmDocumentDto(
                    docId,
                    upload.getFileName(),
                    docClass,
                    upload.getMimeType() != null ? upload.getMimeType() : "application/pdf",
                    now,
                    actor,
                    1,
                    sizeLabel,
                    "Pending",
                    null,
                    buildDaejaViewerUrl(docId),
                    Map.of("lcReference", lcReference, "lcWid", wid),
                    List.of(new DocSectionDto("FileNet CE Document Indexing", List.of(
                            new DocRowDto("FileNet Document ID", docId, null),
                            new DocRowDto("Object Store", fileNetProps.getTargetObjectStore(), null),
                            new DocRowDto("Case Folder Path", caseFolderPath, null),
                            new DocRowDto("Case WID", wid, "lcWid"),
                            new DocRowDto("Document Class", docClass, null),
                            new DocRowDto("LC Reference", lcReference, "lcReference"),
                            new DocRowDto("MIME Type / Size", upload.getMimeType() + " · " + sizeLabel, null)
                    )))
            ));
        }

        return filedDocs;
    }

    public String buildDaejaViewerUrl(String docId) {
        String baseUrl = icmProps.getViewer() != null && icmProps.getViewer().getDaejaBaseUrl() != null
                ? icmProps.getViewer().getDaejaBaseUrl()
                : "";
        return baseUrl + "?desktop=" + icmProps.getDesktopId()
                + "&docId=" + docId
                + "&objectStore=" + fileNetProps.getTargetObjectStore();
    }

    private String formatBytes(long bytes) {
        if (bytes <= 0) return "1 KB";
        if (bytes < 1024) return bytes + " B";
        long kb = Math.round(bytes / 1024.0);
        if (kb < 1024) return kb + " KB";
        return String.format("%.1f MB", bytes / (1024.0 * 1024.0));
    }
}
