package com.tradefinance.lc.controller;

import com.tradefinance.lc.dto.IcmDtos.*;
import com.tradefinance.lc.service.IcmCaseGatewayService;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/icm")
public class IcmWorkController {

    private final IcmCaseGatewayService gatewayService;

    public IcmWorkController(IcmCaseGatewayService gatewayService) {
        this.gatewayService = gatewayService;
    }

    /**
     * Loads role routing, configurable intake fields (from case-intake.properties),
     * and an auto-generated 6-digit WID for the Add Case screen.
     */
    @GetMapping("/intake-config")
    public IntakeConfigResponse getIntakeConfig() {
        return gatewayService.getIntakeConfig();
    }

    /**
     * Creates a new Case inside IBM ICM with the 6-digit WID, persists Custom DB intake records,
     * files single or multiple attached documents in FileNet CE, and lands the case at Maker Stage.
     */
    @PostMapping("/cases")
    public ResponseEntity<WorkItemDto> createCase(@RequestBody CreateCaseRequest request) {
        return ResponseEntity.ok(gatewayService.createCase(request));
    }

    /**
     * Multipart form upload alternative for native Tomcat / HTML / binary FileNet CE ingestion.
     */
    @PostMapping(value = "/cases/multipart", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<WorkItemDto> createCaseMultipart(
            @RequestParam(required = false) String wid,
            @RequestParam Map<String, String> fields,
            @RequestParam(defaultValue = "LC Application Form") String docClass,
            @RequestParam(defaultValue = "Priya Nair") String actor,
            @RequestPart(value = "files", required = false) List<MultipartFile> files) throws IOException {

        List<UploadedDocumentDto> uploads = new ArrayList<>();
        if (files != null) {
            for (MultipartFile file : files) {
                if (!file.isEmpty()) {
                    uploads.add(new UploadedDocumentDto(
                            file.getOriginalFilename(),
                            file.getContentType(),
                            file.getSize(),
                            docClass,
                            null,
                            null
                    ));
                }
            }
        }
        return ResponseEntity.ok(gatewayService.createCase(new CreateCaseRequest(wid, fields, uploads, actor)));
    }

    @GetMapping("/inbaskets")
    public List<InBasketDto> getInBaskets() {
        return gatewayService.getInBaskets();
    }

    @GetMapping("/workitems")
    public List<WorkItemDto> getWorkItems(@RequestParam(required = false) String inBasketId) {
        return gatewayService.getWorkItems(inBasketId);
    }

    @GetMapping("/workitems/{wobNum}")
    public ResponseEntity<WorkItemDto> getWorkItem(@PathVariable String wobNum) {
        WorkItemDto item = gatewayService.getWorkItem(wobNum);
        if (item == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(item);
    }

    @GetMapping("/cases/{caseId}")
    public ResponseEntity<WorkItemDto> getCaseById(@PathVariable String caseId) {
        WorkItemDto item = gatewayService.getCaseById(caseId);
        if (item == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(item);
    }

    @PostMapping("/workitems/{wobNum}/save")
    public WorkItemDto saveFields(@PathVariable String wobNum, @RequestBody SaveFieldsRequest request) {
        return gatewayService.saveFields(wobNum, request.getFieldValues(), request.getActor());
    }

    @PostMapping("/workitems/{wobNum}/complete")
    public CompleteStepResponse completeStep(
            @PathVariable String wobNum, @RequestBody CompleteStepRequest request) {
        return gatewayService.completeStep(wobNum, request);
    }

    @PostMapping("/workitems/{wobNum}/reassign")
    public WorkItemDto reassign(@PathVariable String wobNum, @RequestBody ReassignRequest request) {
        return gatewayService.reassign(wobNum, request.getTargetUser(), request.getActor());
    }

    @PostMapping("/cases/{caseId}/documents/{docId}/status")
    public WorkItemDto updateDocumentStatus(
            @PathVariable String caseId,
            @PathVariable String docId,
            @RequestBody DocumentStatusRequest request) {
        return gatewayService.updateDocumentStatus(caseId, docId, request);
    }

    @PostMapping("/cases/{caseId}/comments")
    public WorkItemDto addComment(@PathVariable String caseId, @RequestBody CommentRequest request) {
        return gatewayService.addComment(caseId, request);
    }
}
