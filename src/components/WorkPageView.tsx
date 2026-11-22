import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  FolderOpen,
  Layers,
  Save,
  UserPlus,
} from 'lucide-react';
import type {
  CaseFieldDefinition,
  DocumentVerificationStatus,
  IcmWorkItem,
  WorkViewMode,
} from '../types/icm';
import { computeFieldMetrics, isFieldEmpty } from '../utils/fieldMetrics';
import {
  ColumnLayoutMode,
  FieldFilterMode,
  FieldSourceFilter,
  FieldsMatrix,
} from './FieldsMatrix';
import { IcmDocumentViewer } from './IcmDocumentViewer';

interface WorkPageViewProps {
  workItem: IcmWorkItem;
  onBackToInbox: () => void;
  onOpenCase360: (caseId: string) => void;
  onSaveFields: (wobNum: string, fieldValues: Record<string, string>) => Promise<void>;
  onCompleteStep: (
    wobNum: string,
    outcome: string,
    reason: string,
    fieldValues: Record<string, string>
  ) => Promise<void>;
  onReassign: (wobNum: string, targetUser: string) => Promise<void>;
  onUpdateDocumentStatus: (
    caseId: string,
    docId: string,
    status: DocumentVerificationStatus,
    note: string
  ) => Promise<void>;
}

export const WorkPageView: React.FC<WorkPageViewProps> = ({
  workItem,
  onBackToInbox,
  onOpenCase360,
  onSaveFields,
  onCompleteStep,
  onReassign,
  onUpdateDocumentStatus,
}) => {
  const [viewMode, setViewMode] = useState<WorkViewMode>('split');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [filterMode, setFilterMode] = useState<FieldFilterMode>('all');
  const [sourceFilter, setSourceFilter] = useState<FieldSourceFilter>('all');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact');
  const [columns, setColumns] = useState<ColumnLayoutMode>('auto');
  const [activeDocId, setActiveDocId] = useState<string>(workItem.documents[0]?.id || '');
  const [highlightedDocKey, setHighlightedDocKey] = useState<string | null>(null);
  const [highlightedFieldKey, setHighlightedFieldKey] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string>('');
  const [decisionReason, setDecisionReason] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [completing, setCompleting] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showReassignMenu, setShowReassignMenu] = useState<boolean>(false);
  const [reassignUser, setReassignUser] = useState<string>('Rohan Mehta');
  const [mandatoryCursor, setMandatoryCursor] = useState<number>(0);

  // Sync draft state when workItem changes
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const f of workItem.fields) {
      initial[f.key] = f.value;
    }
    setFieldValues(initial);
    setActiveDocId(workItem.documents[0]?.id || '');
    setSelectedOutcome('');
    setDecisionReason('');
    setFeedbackBanner(null);
    setHighlightedFieldKey(null);
    setHighlightedDocKey(null);
    setMandatoryCursor(0);
    setCollapsedSections(new Set());
  }, [workItem.wobNum]);

  const liveFields = useMemo(
    () =>
      workItem.fields.map((f) => ({
        ...f,
        value: Object.prototype.hasOwnProperty.call(fieldValues, f.key)
          ? fieldValues[f.key]
          : f.value,
      })),
    [workItem.fields, fieldValues]
  );

  const metrics = useMemo(() => computeFieldMetrics(liveFields), [liveFields]);

  const missingMandatoryFields = useMemo(
    () => liveFields.filter((f) => f.required && isFieldEmpty(f.value)),
    [liveFields]
  );

  const isDirty = useMemo(
    () => workItem.fields.some((f) => (fieldValues[f.key] ?? f.value) !== f.value),
    [workItem.fields, fieldValues]
  );

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleFocusField = (field: CaseFieldDefinition) => {
    setHighlightedFieldKey(field.key);
    if (field.linkedDocHighlight) {
      setHighlightedDocKey(field.linkedDocHighlight);
    }
  };

  const handleExpandSection = (section: string) => {
    setCollapsedSections((prev) => {
      if (!prev.has(section)) return prev;
      const next = new Set(prev);
      next.delete(section);
      return next;
    });
  };

  const jumpAndFocusField = (target: CaseFieldDefinition) => {
    if (viewMode === 'document') {
      setViewMode('split');
    }
    if (filterMode === 'filled') {
      setFilterMode('all');
    }
    if (sourceFilter !== 'all' && sourceFilter !== target.source) {
      setSourceFilter('all');
    }

    handleExpandSection(target.section);
    setHighlightedFieldKey(target.key);
    if (target.linkedDocHighlight) {
      setHighlightedDocKey(target.linkedDocHighlight);
    }

    requestAnimationFrame(() => {
      const rowEl = document.getElementById(`field-row-${target.key}`);
      const inputEl = document.getElementById(`input-${target.key}`);
      rowEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      inputEl?.focus();
    });
  };

  const handleJumpToNextMandatory = () => {
    if (missingMandatoryFields.length === 0) return;
    const idx = mandatoryCursor % missingMandatoryFields.length;
    const target = missingMandatoryFields[idx];
    setMandatoryCursor((c) => c + 1);
    jumpAndFocusField(target);
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedbackBanner(null);
    try {
      await onSaveFields(workItem.wobNum, fieldValues);
      setFeedbackBanner({
        type: 'success',
        text: 'Saved core properties to IBM Case Manager and extended fields to Custom DB.',
      });
    } catch (err) {
      setFeedbackBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save work item fields.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (overrideOutcome?: string) => {
    const outcomeToSend = overrideOutcome || selectedOutcome;
    if (!outcomeToSend) {
      setFeedbackBanner({
        type: 'error',
        text: 'Select a workflow outcome (e.g., Approve & Release MT700) before completing.',
      });
      return;
    }

    const isPositiveRelease =
      outcomeToSend.toLowerCase().includes('approve') ||
      outcomeToSend.toLowerCase().includes('clean');

    if (isPositiveRelease && metrics.mandatoryEmpty > 0) {
      setFeedbackBanner({
        type: 'error',
        text: `${metrics.mandatoryEmpty} mandatory field(s) are still empty. Complete highlighted required fields before release.`,
      });
      handleJumpToNextMandatory();
      return;
    }

    setCompleting(true);
    setFeedbackBanner(null);
    try {
      await onCompleteStep(workItem.wobNum, outcomeToSend, decisionReason, fieldValues);
    } catch (err) {
      setFeedbackBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to complete workflow step.',
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleToggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const allSectionNames = useMemo(
    () => Array.from(new Set(workItem.fields.map((f) => f.section))),
    [workItem.fields]
  );

  return (
    <div className="w-full px-4 sm:px-5 pt-2.5 pb-16 space-y-2">
      {/* Top Breadcrumb + View Mode Switcher + Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToInbox}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-xs font-medium text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Inbox</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-[#6E5D66] dark:text-[#BDAAB3] truncate">
            <span className="font-mono font-bold text-[#97144D] dark:text-[#F48FB1]">
              {workItem.lcReference}
            </span>
            {workItem.wid && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                  WID {workItem.wid}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-500 dark:text-slate-400">{workItem.caseId}</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{workItem.subject}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-0.5 rounded-lg bg-[#F3E5EC] dark:bg-[#281A22]">
            {(
              [
                { id: 'split', label: 'Split Workbench' },
                { id: 'fields', label: 'Fields Only' },
                { id: 'document', label: 'Docs & SWIFT' },
              ] as { id: WorkViewMode; label: string }[]
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  viewMode === mode.id
                    ? 'bg-white dark:bg-[#191116] text-[#97144D] dark:text-[#F48FB1] font-semibold shadow-xs'
                    : 'text-[#6E5D66] dark:text-[#BDAAB3] hover:text-[#1D161A] dark:hover:text-[#F5EDF1]'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onOpenCase360(workItem.caseId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-xs font-medium text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#97144D] dark:text-[#F48FB1]" />
            <span>Case 360°</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReassignMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-xs font-medium text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#97144D] dark:text-[#F48FB1]" />
              <span>Reassign</span>
            </button>

            {showReassignMenu && (
              <div className="absolute right-0 top-10 z-40 w-64 p-3 rounded-xl border border-[#EBDCE3] dark:border-[#3A2732] bg-white dark:bg-[#191116] shadow-lg space-y-2">
                <div className="text-xs font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                  Reassign Work Item ({workItem.wobNum})
                </div>
                <select
                  value={reassignUser}
                  onChange={(e) => setReassignUser(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#120D11] text-[#1D161A] dark:text-[#F5EDF1] focus:outline-none focus:border-[#97144D]"
                >
                  <option value="Ahmad Jamal">Ahmad Jamal (Trade Checker)</option>
                  <option value="Priya Nair">Priya Nair (LC Maker)</option>
                  <option value="Rohan Mehta">Rohan Mehta (Doc Examiner)</option>
                  <option value="S. Kulkarni">S. Kulkarni (Compliance)</option>
                </select>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReassignMenu(false)}
                    className="px-2.5 py-1 text-xs text-[#6E5D66] dark:text-[#BDAAB3] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onReassign(workItem.wobNum, reassignUser);
                      setShowReassignMenu(false);
                      setFeedbackBanner({
                        type: 'success',
                        text: `Reassigned work item to ${reassignUser}.`,
                      });
                    }}
                    className="px-3 py-1 rounded-md bg-[#97144D] text-white text-xs font-medium hover:bg-[#7A0E3D] cursor-pointer"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unified Case Summary, Milestone Stepper & Dual-Source Readiness Strip */}
      <div className="px-3.5 py-2.5 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] shadow-[0_6px_22px_-14px_rgba(151,20,77,0.16)] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{workItem.processType}</span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span
              className={`font-semibold ${
                workItem.priority === 'High'
                  ? 'text-red-700 dark:text-red-400'
                  : workItem.priority === 'Medium'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {workItem.priority} Priority
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-slate-600 dark:text-slate-300">{workItem.caseMode} Mode</span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400 font-semibold">
              SLA {workItem.slaLabel}
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-slate-600 dark:text-slate-400">
              Maker <strong className="text-slate-800 dark:text-slate-200">{workItem.makerName}</strong> · Checker{' '}
              <strong className="text-slate-800 dark:text-slate-200">{workItem.checkerName}</strong>
            </span>
          </div>

          <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            WOB {workItem.wobNum} · Ageing {workItem.ageingLabel} · Branch {workItem.branchCode}
          </div>
        </div>

        {/* Crisp Horizontal Workflow Stepper */}
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          {workItem.stages.map((stage, idx) => (
            <React.Fragment key={stage.id}>
              <div className="flex items-center gap-2 whitespace-nowrap shrink-0 text-xs">
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-semibold border ${
                    stage.status === 'completed'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : stage.status === 'active'
                      ? 'bg-[#97144D] border-[#97144D] text-white'
                      : 'bg-[#FBF2F6] dark:bg-[#22151D] border-[#E7D8DF] dark:border-[#3A2732] text-[#6E5D66] dark:text-[#BDAAB3]'
                  }`}
                >
                  {stage.status === 'completed' ? <Check className="w-3 h-3" /> : idx + 1}
                </span>
                <span
                  className={
                    stage.status === 'active'
                      ? 'font-semibold text-[#97144D] dark:text-[#F48FB1]'
                      : stage.status === 'completed'
                      ? 'font-medium text-[#3E3239] dark:text-[#DECED6]'
                      : 'text-[#8C7A83] dark:text-[#8E7A84]'
                  }
                >
                  {stage.label}
                </span>
              </div>
              {idx < workItem.stages.length - 1 && (
                <div className="flex-1 min-w-[20px] h-px bg-[#EBDCE3] dark:bg-[#32222B]" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Readiness Strip: Total Filled, Pending Empty, ICM vs Custom DB Filter Counters + Mandatory Jump */}
        <div className="pt-2 border-t border-[#F0E3E9] dark:border-[#2E1F27] flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    metrics.mandatoryEmpty > 0 ? 'bg-amber-500' : 'bg-emerald-600'
                  }`}
                  style={{ width: `${metrics.completionPct}%` }}
                />
              </div>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                {metrics.filled}/{metrics.total} Filled ({metrics.completionPct}%)
              </span>
            </div>

            <span className="text-slate-300 dark:text-slate-700">|</span>

            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
              Pending Empty: <strong className="text-slate-900 dark:text-slate-100">{metrics.empty}</strong>
            </span>

            <button
              type="button"
              onClick={() => setSourceFilter((prev) => (prev === 'ICM' ? 'all' : 'ICM'))}
              title="Filter IBM Case Manager properties"
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono tabular-nums transition-colors cursor-pointer ${
                sourceFilter === 'ICM'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200'
                  : 'border-blue-200/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 text-slate-700 dark:text-slate-300 hover:border-blue-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span className="font-sans font-medium text-blue-800 dark:text-blue-300">ICM Case:</span>
              <strong className="text-slate-900 dark:text-slate-100">
                {metrics.icmFilled}/{metrics.icmTotal}
              </strong>
            </button>

            <button
              type="button"
              onClick={() => setSourceFilter((prev) => (prev === 'CUSTOM_DB' ? 'all' : 'CUSTOM_DB'))}
              title="Filter Custom DB fields"
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono tabular-nums transition-colors cursor-pointer ${
                sourceFilter === 'CUSTOM_DB'
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200'
                  : 'border-teal-200/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 text-slate-700 dark:text-slate-300 hover:border-teal-400'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              <span className="font-sans font-medium text-teal-800 dark:text-teal-300">Custom DB:</span>
              <strong className="text-slate-900 dark:text-slate-100">
                {metrics.customDbFilled}/{metrics.customDbTotal}
              </strong>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {metrics.mandatoryEmpty > 0 ? (
              <button
                type="button"
                onClick={handleJumpToNextMandatory}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Jump to Mandatory Empty ({metrics.mandatoryEmpty})</span>
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                All {metrics.mandatoryTotal} Mandatory Fields Completed
              </span>
            )}
          </div>
        </div>

        {/* Pinned Key LC Summary Strip */}
        <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">LC Amount (32B)</div>
            <div className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
              {workItem.amountFormatted}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Applicant (50)</div>
            <div className="font-medium text-slate-900 dark:text-slate-100 truncate" title={workItem.applicantName}>
              {workItem.applicantName}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Beneficiary (59)</div>
            <div className="font-medium text-slate-900 dark:text-slate-100 truncate" title={workItem.beneficiaryName}>
              {workItem.beneficiaryName}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Expiry (31D)</div>
            <div className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
              {workItem.expiryDate}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Latest Ship (44C)</div>
            <div className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
              {workItem.latestShipmentDate}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Tenor / Incoterms</div>
            <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
              {workItem.tenor} · {workItem.incoterms}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Sanctions</div>
            <div
              className={`font-semibold ${
                workItem.sanctionsStatus === 'Cleared'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {workItem.sanctionsStatus}
            </div>
          </div>
        </div>
      </div>

      {feedbackBanner && (
        <div
          className={`px-4 py-2 rounded-xl border text-xs font-medium flex items-center justify-between ${
            feedbackBanner.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
              : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
          }`}
        >
          <span>{feedbackBanner.text}</span>
          <button type="button" onClick={() => setFeedbackBanner(null)} className="underline ml-4 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Dual-Pane High-Speed Trade Finance Workbench */}
      <div
        className={`grid gap-3 ${viewMode === 'split' ? 'grid-cols-1 xl:grid-cols-12' : 'grid-cols-1'}`}
      >
        {viewMode !== 'document' && (
          <div className={`${viewMode === 'split' ? 'xl:col-span-7' : ''} h-[calc(100vh-14.25rem)] min-h-[540px]`}>
            <FieldsMatrix
              fields={workItem.fields}
              fieldValues={fieldValues}
              onChangeField={handleFieldChange}
              onFocusField={handleFocusField}
              highlightedFieldKey={highlightedFieldKey}
              filterMode={filterMode}
              onFilterModeChange={setFilterMode}
              sourceFilter={sourceFilter}
              onSourceFilterChange={setSourceFilter}
              collapsedSections={collapsedSections}
              onToggleSection={handleToggleSection}
              onExpandSection={handleExpandSection}
              onExpandAll={() => setCollapsedSections(new Set())}
              onCollapseAll={() => setCollapsedSections(new Set(allSectionNames))}
              density={density}
              onDensityChange={setDensity}
              columns={columns}
              onColumnsChange={setColumns}
            />
          </div>
        )}

        {viewMode !== 'fields' && (
          <div className={`${viewMode === 'split' ? 'xl:col-span-5' : ''} h-[calc(100vh-14.25rem)] min-h-[540px]`}>
            <IcmDocumentViewer
              caseId={workItem.caseId}
              lcReference={workItem.lcReference}
              processType={workItem.processType}
              documents={workItem.documents}
              activeDocId={activeDocId}
              onSelectDoc={setActiveDocId}
              highlightedKey={highlightedDocKey}
              fields={workItem.fields}
              fieldValues={fieldValues}
              onSelectFieldKey={jumpAndFocusField}
              onUpdateStatus={(docId, status, note) =>
                onUpdateDocumentStatus(workItem.caseId, docId, status, note)
              }
            />
          </div>
        )}
      </div>

      {/* Sticky Bottom Disposition & Routing Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#EBDCE3] dark:border-[#32222B] bg-white/95 dark:bg-[#191116]/95 backdrop-blur-sm shadow-[0_-8px_24px_-12px_rgba(151,20,77,0.14)]">
        <div className="w-full px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#120D11] text-xs font-semibold text-[#3E3239] dark:text-[#F5EDF1] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-[#97144D] dark:text-[#F48FB1]" />
              <span>{saving ? 'Saving...' : isDirty ? 'Save Changes*' : 'Save Draft'}</span>
            </button>

            <button
              type="button"
              disabled={completing}
              onClick={() => handleComplete('Return to Maker for Correction')}
              className="px-3 py-2 rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] text-xs font-medium text-[#5E4E56] dark:text-[#CBBCC4] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Return to Maker
            </button>

            <span className="text-xs text-[#6E5D66] dark:text-[#BDAAB3] hidden sm:inline ml-1">
              {isDirty ? 'Unsaved edits ready to sync (ICM + DB)' : 'All changes synced'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
            <select
              aria-label="Select workflow outcome"
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#120D11] text-[#1D161A] dark:text-[#F5EDF1] min-w-[210px] focus:outline-none focus:border-[#97144D]"
            >
              <option value="">Select ICM Step Outcome...</option>
              {workItem.stepOutcomes.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              placeholder="Decision remark / audit note..."
              className="px-3 py-2 text-xs rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#120D11] text-[#1D161A] dark:text-[#F5EDF1] w-56 lg:w-72 focus:outline-none focus:border-[#97144D]"
            />

            <button
              type="button"
              disabled={completing}
              onClick={() => handleComplete()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#97144D] hover:bg-[#7A0E3D] text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap shrink-0 shadow-xs transition-colors cursor-pointer"
            >
              <span>{completing ? 'Completing...' : 'Complete & Next Item'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
