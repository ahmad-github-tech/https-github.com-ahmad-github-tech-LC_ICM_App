export type CasePriority = 'High' | 'Medium' | 'Low';
export type CaseMode = 'Standard' | 'Expedited' | 'Manual';
export type LcProcessType =
  | 'Import LC Issuance'
  | 'LC Amendment (MT707)'
  | 'Document Examination'
  | 'Standby LC / BG';

export type FieldSource = 'ICM' | 'CUSTOM_DB';
export type FieldType = 'text' | 'number' | 'currency' | 'date' | 'select' | 'textarea' | 'boolean';
export type FieldAttention = 'none' | 'warning' | 'error';

export type DocumentVerificationStatus = 'Pending' | 'Verified' | 'Discrepancy';

export interface IcmInBasket {
  id: string;
  name: string;
  roleName: string;
  description: string;
}

export interface CaseFieldDefinition {
  id: string;
  key: string;
  label: string;
  section: string;
  sectionOrder: number;
  swiftTag?: string;
  source: FieldSource;
  icmSymbolicName?: string;
  customDbColumn?: string;
  type: FieldType;
  value: string;
  options?: string[];
  required: boolean;
  readOnly?: boolean;
  attention?: FieldAttention;
  attentionReason?: string;
  placeholder?: string;
  fullWidth?: boolean;
  linkedDocHighlight?: string;
}

export interface IcmDocument {
  id: string;
  title: string;
  docClass: string;
  mimeType: string;
  addedAt: string;
  addedBy: string;
  pageCount: number;
  sizeLabel: string;
  verificationStatus: DocumentVerificationStatus;
  discrepancyNote?: string;
  viewerUrl?: string;
  contentDataUrl?: string;
  textPreview?: string;
  highlights: Record<string, string>;
  previewSections: {
    heading: string;
    rows: { label: string; value: string; highlightKey?: string }[];
  }[];
}

export interface WorkflowStage {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'pending';
  completedBy?: string;
  completedAt?: string;
}

export interface CaseComment {
  id: string;
  author: string;
  role: string;
  timestamp: string;
  message: string;
  actionType?: string;
}

export interface RelatedCaseItem {
  caseId: string;
  lcReference: string;
  relationship: string;
  processType: LcProcessType;
  amountFormatted: string;
  status: string;
}

export interface CaseTaskItem {
  id: string;
  title: string;
  assignedRole: string;
  assignee: string;
  status: 'Completed' | 'In Progress' | 'Pending';
  dueDate: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  event: string;
  details: string;
  source: 'IBM ICM' | 'FileNet CE' | 'Custom DB';
}

export interface IcmWorkItem {
  wid?: string;
  wobNum: string;
  caseId: string;
  lcReference: string;
  inBasketId: string;
  processType: LcProcessType;
  subject: string;
  applicantName: string;
  beneficiaryName: string;
  issuingBank: string;
  advisingBank: string;
  currency: string;
  amount: number;
  amountFormatted: string;
  expiryDate: string;
  latestShipmentDate: string;
  incoterms: string;
  tenor: string;
  stepName: string;
  caseMode: CaseMode;
  priority: CasePriority;
  assignedTo: string;
  makerName: string;
  checkerName: string;
  region: string;
  branchCode: string;
  sanctionsStatus: 'Cleared' | 'Review Required' | 'Pending';
  slaRemainingMinutes: number;
  slaLabel: string;
  createdAt: string;
  enteredQueueAt: string;
  ageingDays: number;
  ageingLabel: string;
  inQueueLabel: string;
  status: string;
  linkedCasesCount: number;
  stepOutcomes: string[];
  stages: WorkflowStage[];
  fields: CaseFieldDefinition[];
  documents: IcmDocument[];
  comments: CaseComment[];
  tasks: CaseTaskItem[];
  relatedCases: RelatedCaseItem[];
  auditTrail: AuditLogEntry[];
}

export interface IntakeFieldConfig {
  key: string;
  label: string;
  type: 'string' | 'select' | 'number' | 'date';
  required: boolean;
  source: FieldSource;
  symbolicName: string;
  dbColumn?: string;
  options: string[];
  placeholder?: string;
}

export interface IntakeRoleConfig {
  roleName: string;
  inBasketId: string;
  stepName: string;
  defaultAssignee: string;
  caseType: string;
  widDigits: number;
}

export interface IntakeConfigResponse {
  roleConfig: IntakeRoleConfig;
  generatedWid: string;
  documentClasses: string[];
  fields: IntakeFieldConfig[];
}

export interface CreateCaseDocumentInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  docClass: string;
  contentDataUrl?: string;
  textPreview?: string;
}

export interface CreateCasePayload {
  wid: string;
  fields: Record<string, string>;
  documents: CreateCaseDocumentInput[];
  actor: string;
}

export interface FieldMetrics {
  total: number;
  filled: number;
  empty: number;
  mandatoryTotal: number;
  mandatoryFilled: number;
  mandatoryEmpty: number;
  attentionCount: number;
  icmTotal: number;
  icmFilled: number;
  customDbTotal: number;
  customDbFilled: number;
  completionPct: number;
}

export type AppView = 'inbox' | 'work' | 'case' | 'search';
export type WorkViewMode = 'split' | 'fields' | 'document';
