import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { IN_BASKETS, INITIAL_WORK_ITEMS, buildStandardLcFields } from './src/data/lcSeedData.ts';
import type {
  CaseFieldDefinition,
  CreateCaseDocumentInput,
  CreateCasePayload,
  DocumentVerificationStatus,
  IcmDocument,
  IcmWorkItem,
  IntakeConfigResponse,
  IntakeFieldConfig,
  IntakeRoleConfig,
  LcProcessType,
} from './src/types/icm.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const INTAKE_PROPS_PATH = path.resolve(__dirname, 'config/case-intake.properties');

// In-memory store simulating IBM ICM Process Engine + Custom DB split persistence
// Replace this service layer with the Spring Boot / FileNet Java API server (java-backend/) in production.
const workItems: IcmWorkItem[] = structuredClone(INITIAL_WORK_ITEMS);
const usedWids = new Set<string>(
  workItems.map((w) => w.wid).filter((v): v is string => Boolean(v))
);

function parseIntakeProperties(): {
  roleConfig: IntakeRoleConfig;
  documentClasses: string[];
  fields: IntakeFieldConfig[];
} {
  const raw = fs.existsSync(INTAKE_PROPS_PATH)
    ? fs.readFileSync(INTAKE_PROPS_PATH, 'utf-8')
    : '';
  const map = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    map.set(trimmed.slice(0, eqIdx).trim(), trimmed.slice(eqIdx + 1).trim());
  }

  const splitCsv = (val?: string) =>
    (val || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const roleConfig: IntakeRoleConfig = {
    roleName: map.get('intake.initial.roleName') || 'TF_LC_MAKER',
    inBasketId: map.get('intake.initial.inBasketId') || 'lc-maker',
    stepName: map.get('intake.initial.stepName') || 'LC Maker Draft & Verify',
    defaultAssignee: map.get('intake.initial.assignee') || 'Priya Nair',
    caseType: map.get('intake.initial.caseType') || 'TF_LC_Case',
    widDigits: Number(map.get('intake.wid.digits') || 6) || 6,
  };

  const documentClasses = splitCsv(
    map.get('intake.document.classes') ||
      'LC Application Form,Proforma Invoice,SWIFT Message,Sales Contract'
  );

  const keys = splitCsv(map.get('intake.fields.order'));
  const fields: IntakeFieldConfig[] = keys.map((key) => {
    const p = `intake.field.${key}.`;
    const typeVal = (map.get(`${p}type`) || 'string').toLowerCase();
    const normalizedType: IntakeFieldConfig['type'] =
      typeVal === 'select' || typeVal === 'number' || typeVal === 'date' ? typeVal : 'string';
    return {
      key,
      label: map.get(`${p}label`) || key,
      type: normalizedType,
      required: (map.get(`${p}required`) || 'false').toLowerCase() === 'true',
      source: map.get(`${p}source`)?.toUpperCase() === 'CUSTOM_DB' ? 'CUSTOM_DB' : 'ICM',
      symbolicName: map.get(`${p}symbolicName`) || key,
      dbColumn: map.get(`${p}dbColumn`) || undefined,
      options: splitCsv(map.get(`${p}options`)),
      placeholder: map.get(`${p}placeholder`) || undefined,
    };
  });

  return { roleConfig, documentClasses, fields };
}

// Separate CustomService helper: generates & stores unique 6-digit WID
const customIntakeService = {
  generateUniqueWid(digits = 6): string {
    const safeDigits = Math.max(4, Math.min(9, digits));
    const min = 10 ** (safeDigits - 1);
    const span = 10 ** safeDigits - min;
    for (let i = 0; i < 40; i++) {
      const candidate = String(min + Math.floor(Math.random() * span));
      if (!usedWids.has(candidate)) return candidate;
    }
    return String(min + (Date.now() % span));
  },
  resolveAndStoreWid(requestedWid: string | undefined, digits = 6): string {
    const rx = new RegExp(`^\\d{${Math.max(4, Math.min(9, digits))}}$`);
    const wid =
      requestedWid && rx.test(requestedWid) && !usedWids.has(requestedWid)
        ? requestedWid
        : this.generateUniqueWid(digits);
    usedWids.add(wid);
    return wid;
  },
};

// Separate FileNet CE Service helper: indexes & files single or multiple browsed docs
const fileNetDocumentService = {
  formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '1 KB';
    if (bytes < 1024) return `${bytes} B`;
    const kb = Math.round(bytes / 1024);
    if (kb < 1024) return `${kb} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
  fileDocumentsToCase(
    wid: string,
    caseId: string,
    lcReference: string,
    docs: CreateCaseDocumentInput[],
    actor: string
  ): IcmDocument[] {
    const nowLabel = new Date().toISOString().slice(0, 16).replace('T', ' ');
    return docs.map((d, idx) => {
      const docId = `FN-DOC-${wid}-${idx + 1}`;
      const sizeLabel = this.formatBytes(d.sizeBytes);
      return {
        id: docId,
        title: d.fileName,
        docClass: d.docClass || 'LC Application Form',
        mimeType: d.mimeType || 'application/octet-stream',
        addedAt: nowLabel,
        addedBy: actor,
        pageCount: 1,
        sizeLabel,
        verificationStatus: 'Pending',
        viewerUrl: `https://icm-navigator.bank.internal/navigator/bookmark.jsp?docId=${docId}`,
        contentDataUrl: d.contentDataUrl,
        textPreview: d.textPreview,
        highlights: { lcReference, lcWid: wid },
        previewSections: [
          {
            heading: 'FileNet CE Case Folder Filing Record',
            rows: [
              { label: 'FileNet Doc ID', value: docId },
              { label: 'Case Folder', value: caseId },
              { label: 'Work Intake ID (WID)', value: wid, highlightKey: 'lcWid' },
              { label: 'Document Class', value: d.docClass || 'LC Application Form' },
              { label: 'LC Reference', value: lcReference, highlightKey: 'lcReference' },
              { label: 'MIME / File Size', value: `${d.mimeType || 'application/octet-stream'} · ${sizeLabel}` },
            ],
          },
        ],
      };
    });
  },
};

// Separate IBM ICM CaseCreation Service helper: receives 6-digit WID & routes to Maker Stage
const icmCaseCreationService = {
  createIcmCase(
    wid: string,
    roleConfig: IntakeRoleConfig,
    schemaFields: IntakeFieldConfig[],
    submitted: Record<string, string>,
    actor: string
  ): IcmWorkItem {
    const operationTypeRaw = submitted.LC_Operation_Type || 'Import LC Issuance';
    const validProcessTypes: LcProcessType[] = [
      'Import LC Issuance',
      'LC Amendment (MT707)',
      'Document Examination',
      'Standby LC / BG',
    ];
    const processType: LcProcessType = validProcessTypes.includes(operationTypeRaw as LcProcessType)
      ? (operationTypeRaw as LcProcessType)
      : 'Import LC Issuance';

    const applicantName = submitted.LC_Applicant_Name || '';
    const beneficiaryName = submitted.LC_Beneficiary_Name || '';
    const solId = submitted.LC_SOL_ID || '0041';
    const customerId = submitted.LC_Customer_ID || '';

    const refPrefix = processType.includes('Amendment')
      ? 'AMD'
      : processType.includes('Standby')
      ? 'SBLC'
      : processType.includes('Examination')
      ? 'EXM'
      : 'ILC';
    const cleanSol = solId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'MUM';
    const lcReference = `${refPrefix}-${cleanSol}-${wid}`;
    const caseId = `CASE-LC-WID-${wid}`;
    const wobNum = `WOB-${wid}`;
    const nowIso = new Date().toISOString();
    const nowLabel = nowIso.slice(0, 16).replace('T', ' ');

    // Build configurable intake header fields + standard editable LC matrix
    const intakeHeaderFields: CaseFieldDefinition[] = [
      {
        id: `${lcReference}-wid`,
        key: 'lcWid',
        label: 'Work Intake ID (WID)',
        section: '00. Case Intake Header',
        sectionOrder: 0,
        source: 'ICM',
        icmSymbolicName: 'LC_WID',
        type: 'text',
        value: wid,
        required: true,
        readOnly: true,
      },
      ...schemaFields.map((cfg, idx): CaseFieldDefinition => {
        const val = submitted[cfg.key] ?? '';
        const isEmpty = !val.trim();
        return {
          id: `${lcReference}-intake-${idx + 1}`,
          key: cfg.key,
          label: cfg.label,
          section: '00. Case Intake Header',
          sectionOrder: 0,
          source: cfg.source,
          icmSymbolicName: cfg.source === 'ICM' ? cfg.symbolicName : undefined,
          customDbColumn: cfg.source === 'CUSTOM_DB' ? cfg.dbColumn || cfg.key.toLowerCase() : undefined,
          type: cfg.type === 'select' ? 'select' : cfg.type === 'number' ? 'number' : cfg.type === 'date' ? 'date' : 'text',
          options: cfg.options.length > 0 ? cfg.options : undefined,
          value: val,
          required: cfg.required,
          attention: cfg.required && isEmpty ? 'error' : 'none',
          attentionReason: cfg.required && isEmpty ? 'Mandatory intake field is empty' : undefined,
        };
      }),
    ];

    const standardFields = buildStandardLcFields(
      lcReference,
      applicantName,
      beneficiaryName,
      'USD',
      '',
      '',
      '',
      '',
      '',
      'CIF',
      'AT SIGHT',
      '',
      '',
      '',
      {
        applicantCif: {
          value: customerId,
          required: false,
          attention: 'none',
        },
        beneficiaryName: {
          value: beneficiaryName,
          attention: beneficiaryName.trim() ? 'none' : 'error',
          attentionReason: beneficiaryName.trim() ? undefined : 'Pending Maker capture for MT700 :59:',
        },
        beneficiaryCountry: { value: '', attention: 'error', attentionReason: 'Pending Maker capture' },
        advisingBankName: { value: '', attention: 'error', attentionReason: 'Pending Maker capture' },
        advisingBankBic: { value: '', attention: 'error', attentionReason: 'Pending Maker capture' },
        lcAmount: { value: '', attention: 'error', attentionReason: 'Pending Maker amount capture' },
        expiryDate: { value: '', attention: 'error', attentionReason: 'Pending Maker expiry date' },
        latestShipmentDate: { value: '', attention: 'error', attentionReason: 'Pending Maker shipment date' },
        portOfLoading: { value: '', attention: 'error', attentionReason: 'Pending Maker port capture' },
        portOfDischarge: { value: '', attention: 'error', attentionReason: 'Pending Maker port capture' },
        goodsDescription: { value: '', attention: 'error', attentionReason: 'Pending Maker goods description' },
        documentsRequired: { value: '', attention: 'error', attentionReason: 'Pending Maker documents clause' },
        sanctionsScreenRef: { value: '', attention: 'error', attentionReason: 'Pending Sanctions screening ref' },
        coreBankingRef: { value: '', attention: 'error', attentionReason: 'Pending CBS booking ref' },
      }
    );

    return {
      wid,
      wobNum,
      caseId,
      lcReference,
      inBasketId: roleConfig.inBasketId,
      processType,
      subject: `${processType} · ${applicantName} (WID ${wid})`,
      applicantName,
      beneficiaryName: beneficiaryName || 'Pending Maker Capture',
      issuingBank: `Meridian Trade Bank (SOL ${solId})`,
      advisingBank: 'Pending Maker Assignment',
      currency: 'USD',
      amount: 0,
      amountFormatted: 'USD 0.00',
      expiryDate: 'TBD',
      latestShipmentDate: 'TBD',
      incoterms: 'CIF',
      tenor: 'AT SIGHT',
      stepName: roleConfig.stepName,
      caseMode: 'Standard',
      priority: 'Medium',
      assignedTo: roleConfig.defaultAssignee,
      makerName: roleConfig.defaultAssignee,
      checkerName: 'Pending 4-Eyes',
      region: `SOL ${solId}`,
      branchCode: solId,
      sanctionsStatus: 'Pending',
      slaRemainingMinutes: 480,
      slaLabel: '8h 00m left',
      createdAt: nowIso,
      enteredQueueAt: nowIso,
      ageingDays: 0,
      ageingLabel: 'Just created',
      inQueueLabel: 'Just created',
      status: 'Pending Maker Completion',
      linkedCasesCount: 0,
      stepOutcomes: ['Submit to 4-Eyes Checker', 'Save Draft', 'Refer to Sanctions / TBML'],
      stages: [
        { id: 's1', label: `Intake (WID ${wid})`, status: 'completed', completedBy: actor, completedAt: nowLabel },
        { id: 's2', label: 'LC Maker Draft', status: 'active' },
        { id: 's3', label: '4-Eyes Checker', status: 'pending' },
        { id: 's4', label: 'MT700 Dispatch', status: 'pending' },
      ],
      fields: [...intakeHeaderFields, ...standardFields],
      documents: [],
      comments: [],
      tasks: [
        {
          id: `t-${wid}-1`,
          title: 'Complete MT700 Credit Terms & Core Banking Reference',
          assignedRole: roleConfig.roleName,
          assignee: roleConfig.defaultAssignee,
          status: 'In Progress',
          dueDate: nowLabel,
        },
      ],
      relatedCases: [],
      auditTrail: [
        {
          id: `a-${Date.now()}-icm-create`,
          timestamp: nowLabel,
          actor,
          role: 'Intake Officer',
          event: `IBM ICM Case Created (WID ${wid})`,
          details: `Created CaseType ${roleConfig.caseType} with WID ${wid} and routed to ${roleConfig.roleName} (${roleConfig.inBasketId})`,
          source: 'IBM ICM',
        },
      ],
    };
  },
};

function findItemByWob(wobNum: string): IcmWorkItem | undefined {
  return workItems.find((item) => item.wobNum === wobNum);
}

function findItemByCaseId(caseId: string): IcmWorkItem | undefined {
  return workItems.find((item) => item.caseId === caseId || item.lcReference === caseId);
}

function applyFieldUpdates(item: IcmWorkItem, fieldValues: Record<string, string>): { icmUpdated: number; customDbUpdated: number } {
  let icmUpdated = 0;
  let customDbUpdated = 0;

  for (const field of item.fields) {
    if (Object.prototype.hasOwnProperty.call(fieldValues, field.key) && !field.readOnly) {
      const nextVal = String(fieldValues[field.key] ?? '');
      if (field.value !== nextVal) {
        field.value = nextVal;
        if (field.source === 'ICM') icmUpdated += 1;
        else customDbUpdated += 1;
      }

      // Clear missing mandatory error automatically once filled
      const trimmed = nextVal.trim();
      if (field.required && trimmed !== '' && trimmed !== '—' && field.attention === 'error') {
        field.attention = 'none';
        field.attentionReason = undefined;
      } else if (field.required && (trimmed === '' || trimmed === '—')) {
        field.attention = 'error';
        field.attentionReason = field.attentionReason || 'Mandatory field is empty';
      }
    }
  }

  // Keep summary header fields synced with core ICM properties
  const amtField = item.fields.find((f) => f.key === 'lcAmount');
  const ccyField = item.fields.find((f) => f.key === 'currency');
  const expField = item.fields.find((f) => f.key === 'expiryDate');
  const shipField = item.fields.find((f) => f.key === 'latestShipmentDate');
  if (amtField && ccyField) {
    item.currency = ccyField.value || item.currency;
    item.amountFormatted = `${item.currency} ${amtField.value || '0.00'}`;
    const parsedNum = Number(String(amtField.value).replace(/,/g, ''));
    if (!Number.isNaN(parsedNum) && parsedNum > 0) {
      item.amount = parsedNum;
    }
  }
  if (expField && expField.value) item.expiryDate = expField.value;
  if (shipField && shipField.value) item.latestShipmentDate = shipField.value;

  return { icmUpdated, customDbUpdated };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'meridian-tradeflow-icm-gateway' });
  });

  // Configurable Case Intake Schema & Auto-Generated 6-digit WID (from config/case-intake.properties)
  app.get('/api/icm/intake-config', (_req, res) => {
    const parsed = parseIntakeProperties();
    const payload: IntakeConfigResponse = {
      roleConfig: parsed.roleConfig,
      generatedWid: customIntakeService.generateUniqueWid(parsed.roleConfig.widDigits),
      documentClasses: parsed.documentClasses,
      fields: parsed.fields,
    };
    res.json(payload);
  });

  // Create Case inside IBM ICM + FileNet CE Documents + Custom DB WID Storage (routes to Maker Stage)
  app.post('/api/icm/cases', (req, res) => {
    const parsed = parseIntakeProperties();
    const body = req.body as Partial<CreateCasePayload>;
    const submitted = body?.fields || {};
    const actor = body?.actor?.trim() || parsed.roleConfig.defaultAssignee;

    const missing = parsed.fields
      .filter((f) => f.required && !(submitted[f.key] || '').trim())
      .map((f) => f.label);

    if (missing.length > 0) {
      res.status(400).json({ error: `Missing mandatory fields: ${missing.join(', ')}` });
      return;
    }

    // 1. CustomService: reserve & store unique 6-digit WID
    const wid = customIntakeService.resolveAndStoreWid(body?.wid, parsed.roleConfig.widDigits);

    // 2. ICM Service: execute CaseCreation passing 6-digit WID & properties, land at Maker stage
    const createdItem = icmCaseCreationService.createIcmCase(
      wid,
      parsed.roleConfig,
      parsed.fields,
      submitted,
      actor
    );

    // 3. FileNet Service: file uploaded documents (single or multiple) into Case folder
    const uploadedDocs = Array.isArray(body?.documents) ? body.documents : [];
    const filedDocs = fileNetDocumentService.fileDocumentsToCase(
      wid,
      createdItem.caseId,
      createdItem.lcReference,
      uploadedDocs,
      actor
    );
    createdItem.documents = filedDocs;

    const nowLabel = new Date().toISOString().slice(0, 16).replace('T', ' ');
    if (filedDocs.length > 0) {
      createdItem.auditTrail.unshift({
        id: `a-${Date.now()}-fn`,
        timestamp: nowLabel,
        actor,
        role: 'FileNet Filing Agent',
        event: `${filedDocs.length} Document(s) Filed into Case Folder`,
        details: `Filed ${filedDocs.map((d) => d.title).join(', ')} for WID ${wid}`,
        source: 'FileNet CE',
      });
    }
    createdItem.auditTrail.unshift({
      id: `a-${Date.now()}-db`,
      timestamp: nowLabel,
      actor,
      role: 'Custom DB Service',
      event: `WID ${wid} Stored in Custom Intake DB`,
      details: `Persisted 6-digit WID ${wid} & Custom DB intake attributes`,
      source: 'Custom DB',
    });

    workItems.unshift(createdItem);
    res.status(201).json(createdItem);
  });

  // Get IBM ICM In-baskets
  app.get('/api/icm/inbaskets', (_req, res) => {
    res.json(IN_BASKETS);
  });

  // Get Work Items (optionally filtered by inBasketId)
  app.get('/api/icm/workitems', (req, res) => {
    const inBasketId = typeof req.query.inBasketId === 'string' ? req.query.inBasketId : '';
    const filtered = inBasketId ? workItems.filter((w) => w.inBasketId === inBasketId) : workItems;
    res.json(filtered);
  });

  // Get Single Work Item by WOB Number
  app.get('/api/icm/workitems/:wobNum', (req, res) => {
    const item = findItemByWob(req.params.wobNum);
    if (!item) {
      res.status(404).json({ error: `Work item ${req.params.wobNum} not found` });
      return;
    }
    res.json(item);
  });

  // Get Master Case 360 View by Case ID or LC Reference
  app.get('/api/icm/cases/:caseId', (req, res) => {
    const item = findItemByCaseId(req.params.caseId);
    if (!item) {
      res.status(404).json({ error: `Case ${req.params.caseId} not found` });
      return;
    }
    res.json(item);
  });

  // Save Work Item Fields (routes ICM properties -> ICM Case API, Custom Fields -> Custom DB)
  app.post('/api/icm/workitems/:wobNum/save', (req, res) => {
    const item = findItemByWob(req.params.wobNum);
    if (!item) {
      res.status(404).json({ error: `Work item ${req.params.wobNum} not found` });
      return;
    }

    const body = req.body as { fieldValues?: Record<string, string>; actor?: string };
    const fieldValues = body?.fieldValues || {};
    const actor = body?.actor || 'Ahmad Jamal';

    const { icmUpdated, customDbUpdated } = applyFieldUpdates(item, fieldValues);

    const nowLabel = new Date().toISOString().slice(0, 16).replace('T', ' ');
    if (icmUpdated > 0) {
      item.auditTrail.unshift({
        id: `a-${Date.now()}-icm`,
        timestamp: nowLabel,
        actor,
        role: 'Trade User',
        event: 'ICM Properties Saved',
        details: `Updated ${icmUpdated} core property value(s) in IBM ICM Case`,
        source: 'IBM ICM',
      });
    }
    if (customDbUpdated > 0) {
      item.auditTrail.unshift({
        id: `a-${Date.now()}-db`,
        timestamp: nowLabel,
        actor,
        role: 'Trade User',
        event: 'Custom DB Fields Saved',
        details: `Persisted ${customDbUpdated} extended field(s) to Custom Trade DB`,
        source: 'Custom DB',
      });
    }

    res.json(item);
  });

  // Complete Workflow Step and Dispatch Outcome
  app.post('/api/icm/workitems/:wobNum/complete', (req, res) => {
    const item = findItemByWob(req.params.wobNum);
    if (!item) {
      res.status(404).json({ error: `Work item ${req.params.wobNum} not found` });
      return;
    }

    const body = req.body as {
      outcome?: string;
      reason?: string;
      fieldValues?: Record<string, string>;
      actor?: string;
    };

    const outcome = (body?.outcome || '').trim();
    if (!outcome) {
      res.status(400).json({ error: 'Please select a workflow outcome before completing.' });
      return;
    }

    const reason = (body?.reason || '').trim();
    const actor = body?.actor || 'Ahmad Jamal';

    if (body?.fieldValues) {
      applyFieldUpdates(item, body.fieldValues);
    }

    const nowLabel = new Date().toISOString().slice(0, 16).replace('T', ' ');

    // Advance stage simulation
    const activeIndex = item.stages.findIndex((s) => s.status === 'active');
    if (activeIndex !== -1) {
      item.stages[activeIndex].status = 'completed';
      item.stages[activeIndex].completedBy = actor;
      item.stages[activeIndex].completedAt = nowLabel;
      if (activeIndex + 1 < item.stages.length) {
        item.stages[activeIndex + 1].status = 'active';
      }
    }

    // Route to next logical in-basket based on outcome
    const previousBasket = item.inBasketId;
    if (outcome.toLowerCase().includes('return') || outcome.toLowerCase().includes('maker')) {
      item.inBasketId = 'lc-maker';
      item.stepName = 'Maker Correction';
      item.status = 'Returned to Maker';
    } else if (outcome.toLowerCase().includes('sanctions') || outcome.toLowerCase().includes('tbml')) {
      item.inBasketId = 'compliance';
      item.stepName = 'Compliance Escalation';
      item.status = 'Pending Compliance Review';
    } else if (outcome.toLowerCase().includes('discrepancy') || outcome.toLowerCase().includes('waiver')) {
      item.status = outcome;
      item.stepName = 'Awaiting Applicant Response';
    } else {
      item.status = `Completed (${outcome})`;
      item.stepName = item.stages[Math.min(activeIndex + 1, item.stages.length - 1)]?.label || 'Completed';
    }

    if (reason) {
      item.comments.unshift({
        id: `c-${Date.now()}`,
        author: actor,
        role: 'Trade Examiner',
        timestamp: nowLabel,
        message: reason,
        actionType: outcome,
      });
    }

    item.auditTrail.unshift({
      id: `a-${Date.now()}-step`,
      timestamp: nowLabel,
      actor,
      role: 'Trade User',
      event: `Step Completed: ${outcome}`,
      details: reason ? `Decision note: ${reason}` : `Dispatched from ${previousBasket}`,
      source: 'IBM ICM',
    });

    const nextCandidate =
      workItems.find((w) => w.wobNum !== item.wobNum && w.inBasketId === previousBasket) ||
      workItems.find((w) => w.wobNum !== item.wobNum) ||
      null;

    res.json({
      completedWobNum: item.wobNum,
      updatedItem: item,
      nextWorkItem: nextCandidate,
    });
  });

  // Reassign Work Item
  app.post('/api/icm/workitems/:wobNum/reassign', (req, res) => {
    const item = findItemByWob(req.params.wobNum);
    if (!item) {
      res.status(404).json({ error: `Work item ${req.params.wobNum} not found` });
      return;
    }
    const body = req.body as { targetUser?: string; actor?: string };
    const targetUser = (body?.targetUser || '').trim();
    const actor = body?.actor || 'Ahmad Jamal';

    if (!targetUser) {
      res.status(400).json({ error: 'Target assignee is required' });
      return;
    }

    item.assignedTo = targetUser;
    item.auditTrail.unshift({
      id: `a-${Date.now()}-reassign`,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      actor,
      role: 'Trade User',
      event: 'Work Item Reassigned',
      details: `Reassigned to ${targetUser}`,
      source: 'IBM ICM',
    });

    res.json(item);
  });

  // Update Document Verification Status
  app.post('/api/icm/cases/:caseId/documents/:docId/status', (req, res) => {
    const item = findItemByCaseId(req.params.caseId);
    if (!item) {
      res.status(404).json({ error: `Case ${req.params.caseId} not found` });
      return;
    }
    const doc = item.documents.find((d) => d.id === req.params.docId);
    if (!doc) {
      res.status(404).json({ error: `Document ${req.params.docId} not found` });
      return;
    }

    const body = req.body as {
      verificationStatus?: DocumentVerificationStatus;
      discrepancyNote?: string;
      actor?: string;
    };

    if (body?.verificationStatus) {
      doc.verificationStatus = body.verificationStatus;
    }
    doc.discrepancyNote = body?.discrepancyNote || undefined;

    item.auditTrail.unshift({
      id: `a-${Date.now()}-doc`,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      actor: body?.actor || 'Ahmad Jamal',
      role: 'Document Examiner',
      event: `Document ${doc.verificationStatus}`,
      details: `${doc.title}${doc.discrepancyNote ? ` — ${doc.discrepancyNote}` : ''}`,
      source: 'FileNet CE',
    });

    res.json(item);
  });

  // Add Case Comment
  app.post('/api/icm/cases/:caseId/comments', (req, res) => {
    const item = findItemByCaseId(req.params.caseId);
    if (!item) {
      res.status(404).json({ error: `Case ${req.params.caseId} not found` });
      return;
    }
    const body = req.body as { message?: string; actor?: string; role?: string };
    const message = (body?.message || '').trim();
    if (!message) {
      res.status(400).json({ error: 'Comment message cannot be empty' });
      return;
    }

    const nowLabel = new Date().toISOString().slice(0, 16).replace('T', ' ');
    item.comments.unshift({
      id: `c-${Date.now()}`,
      author: body?.actor || 'Ahmad Jamal',
      role: body?.role || 'Trade Checker',
      timestamp: nowLabel,
      message,
    });
    item.auditTrail.unshift({
      id: `a-${Date.now()}-cmt`,
      timestamp: nowLabel,
      actor: body?.actor || 'Ahmad Jamal',
      role: body?.role || 'Trade Checker',
      event: 'Case Comment Posted',
      details: message.slice(0, 100),
      source: 'Custom DB',
    });

    res.json(item);
  });

  // Serve Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Meridian TradeFlow server running on http://localhost:${PORT}`);
  });
}

startServer();
