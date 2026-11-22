import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  Database,
  Download,
  FileText,
  GitBranch,
  History,
  Layers,
  LayoutGrid,
  MessageSquare,
  Play,
  Send,
} from 'lucide-react';
import type { DocumentVerificationStatus, IcmWorkItem } from '../types/icm';
import { computeFieldMetrics, groupFieldsBySection, isFieldEmpty } from '../utils/fieldMetrics';
import { IcmDocumentViewer } from './IcmDocumentViewer';

interface CasePageViewProps {
  caseItem: IcmWorkItem;
  allCases: IcmWorkItem[];
  onBackToInbox: () => void;
  onOpenWorkItem: (wobNum: string) => void;
  onSelectCase: (caseId: string) => void;
  onAddComment: (caseId: string, message: string) => Promise<void>;
  onUpdateDocumentStatus: (
    caseId: string,
    docId: string,
    status: DocumentVerificationStatus,
    note: string
  ) => Promise<void>;
}

type CaseSectionTab = 'overview' | 'documents' | 'fields' | 'tasks' | 'history' | 'related';

export const CasePageView: React.FC<CasePageViewProps> = ({
  caseItem,
  allCases,
  onBackToInbox,
  onOpenWorkItem,
  onSelectCase,
  onAddComment,
  onUpdateDocumentStatus,
}) => {
  const [activeTab, setActiveTab] = useState<CaseSectionTab>('overview');
  const [activeDocId, setActiveDocId] = useState<string>(caseItem.documents[0]?.id || '');
  const [commentText, setCommentText] = useState<string>('');
  const [postingComment, setPostingComment] = useState<boolean>(false);
  const [fieldSourceFilter, setFieldSourceFilter] = useState<'all' | 'ICM' | 'CUSTOM_DB'>('all');

  const metrics = useMemo(() => computeFieldMetrics(caseItem.fields), [caseItem.fields]);
  const sections = useMemo(() => {
    const filtered =
      fieldSourceFilter === 'all'
        ? caseItem.fields
        : caseItem.fields.filter((f) => f.source === fieldSourceFilter);
    return groupFieldsBySection(filtered);
  }, [caseItem.fields, fieldSourceFilter]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      await onAddComment(caseItem.caseId, commentText.trim());
      setCommentText('');
    } finally {
      setPostingComment(false);
    }
  };

  const handleExportCaseJson = () => {
    const payload = {
      caseId: caseItem.caseId,
      lcReference: caseItem.lcReference,
      processType: caseItem.processType,
      status: caseItem.status,
      icmProperties: caseItem.fields
        .filter((f) => f.source === 'ICM')
        .map((f) => ({ symbolicName: f.icmSymbolicName, label: f.label, value: f.value })),
      customDbFields: caseItem.fields
        .filter((f) => f.source === 'CUSTOM_DB')
        .map((f) => ({ column: f.customDbColumn, label: f.label, value: f.value })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${caseItem.lcReference}_Case360.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navItems: { id: CaseSectionTab; label: string; count?: number; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', count: caseItem.documents.length, icon: <FileText className="w-4 h-4" /> },
    { id: 'fields', label: 'All Fields (ICM + DB)', count: caseItem.fields.length, icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'tasks', label: 'Tasks', count: caseItem.tasks.length, icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'history', label: 'Audit & History', count: caseItem.auditTrail.length, icon: <History className="w-4 h-4" /> },
    { id: 'related', label: 'Related LCs', count: caseItem.relatedCases.length, icon: <GitBranch className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full px-4 sm:px-6 py-4 space-y-4">
      {/* Top Case Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#EBDCE3] dark:border-[#32222B]">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBackToInbox}
            className="mt-0.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-xs font-medium text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Inbox</span>
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E5D66] dark:text-[#BDAAB3]">
              <span className="font-mono font-bold text-[#97144D] dark:text-[#F48FB1]">
                {caseItem.caseId}
              </span>
              {caseItem.wid && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-[#3E3239] dark:text-[#DECED6]">
                    WID {caseItem.wid}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono">{caseItem.lcReference}</span>
              <span aria-hidden="true">·</span>
              <span>{caseItem.processType}</span>
            </div>
            <h1 className="text-lg font-semibold text-[#1D161A] dark:text-[#F5EDF1] mt-0.5">
              {caseItem.subject}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E5D66] dark:text-[#BDAAB3] mt-1">
              <span>
                Status: <strong className="text-[#1D161A] dark:text-[#F5EDF1]">{caseItem.status}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Owner: <strong className="text-[#1D161A] dark:text-[#F5EDF1]">{caseItem.assignedTo}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {metrics.filled}/{metrics.total} fields filled ({metrics.mandatoryEmpty} mandatory empty)
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Switch active Case 360"
            value={caseItem.caseId}
            onChange={(e) => onSelectCase(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-[#1D161A] dark:text-[#F5EDF1] focus:outline-none focus:border-[#97144D]"
          >
            {allCases.map((c) => (
              <option key={c.caseId} value={c.caseId}>
                {c.lcReference} · {c.applicantName}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onOpenWorkItem(caseItem.wobNum)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#97144D] hover:bg-[#7A0E3D] text-white text-xs font-semibold whitespace-nowrap shrink-0 shadow-xs transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Open Work Step</span>
          </button>
        </div>
      </div>

      {/* Left Rail + Main Case Folder Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Navigation Rail */}
        <aside className="lg:col-span-3 xl:col-span-2 space-y-4">
          <div className="p-2 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] shadow-[0_6px_20px_-14px_rgba(151,20,77,0.16)] space-y-1">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#97144D] dark:text-[#F48FB1]">
              Case Navigation
            </div>
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#FDF1F6] dark:bg-[#2F1622] text-[#97144D] dark:text-[#F48FB1] font-semibold'
                      : 'text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF4F8] dark:hover:bg-[#24161E]'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count !== undefined && (
                    <span className="font-mono tabular-nums text-[11px] text-[#8C7A83] dark:text-[#9D8792]">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-3 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] shadow-[0_6px_20px_-14px_rgba(151,20,77,0.14)] space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8C7A83] dark:text-[#9D8792]">
              Quick Actions
            </div>
            <button
              type="button"
              onClick={handleExportCaseJson}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#97144D] dark:text-[#F48FB1]" />
              <span>Export Case Payload</span>
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <div className="lg:col-span-9 xl:col-span-10 space-y-4">
          {activeTab === 'overview' && (
            <>
              {/* Key Case Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#7D0F3E] via-[#97144D] to-[#C2185B] text-white shadow-[0_10px_24px_-10px_rgba(151,20,77,0.45)] space-y-1.5">
                  <div className="text-xs font-medium text-rose-100/90">
                    Credit Exposure & Terms
                  </div>
                  <div className="text-xl font-mono tabular-nums font-bold text-white">
                    {caseItem.amountFormatted}
                  </div>
                  <div className="text-xs text-rose-100/90">
                    {caseItem.tenor} · {caseItem.incoterms} 2020 · Expiry {caseItem.expiryDate}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] shadow-[0_6px_20px_-14px_rgba(151,20,77,0.14)] space-y-1.5">
                  <div className="text-xs font-medium text-[#6E5D66] dark:text-[#BDAAB3]">
                    Trade Counterparties
                  </div>
                  <div className="text-xs text-[#3E3239] dark:text-[#DECED6]">
                    <strong>Applicant:</strong> {caseItem.applicantName}
                  </div>
                  <div className="text-xs text-[#3E3239] dark:text-[#DECED6]">
                    <strong>Beneficiary:</strong> {caseItem.beneficiaryName}
                  </div>
                  <div className="text-xs text-[#6E5D66] dark:text-[#BDAAB3]">
                    Advising: {caseItem.advisingBank}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] shadow-[0_6px_20px_-14px_rgba(151,20,77,0.14)] space-y-1.5">
                  <div className="text-xs font-medium text-[#6E5D66] dark:text-[#BDAAB3]">
                    Data Readiness (ICM + Custom DB)
                  </div>
                  <div className="text-xl font-mono tabular-nums font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                    {metrics.filled}/{metrics.total} ({metrics.completionPct}%)
                  </div>
                  <div className="text-xs text-[#5E4E56] dark:text-[#DECED6]">
                    ICM: {metrics.icmFilled}/{metrics.icmTotal} · Custom DB: {metrics.customDbFilled}/{metrics.customDbTotal} ·{' '}
                    <span className={metrics.mandatoryEmpty > 0 ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-emerald-700 dark:text-emerald-400 font-semibold'}>
                      {metrics.mandatoryEmpty} mandatory empty
                    </span>
                  </div>
                </div>
              </div>

              {/* Workflow Milestones */}
              <div className="p-4 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] shadow-[0_6px_20px_-14px_rgba(151,20,77,0.14)]">
                <h2 className="text-sm font-semibold text-[#1D161A] dark:text-[#F5EDF1] mb-3">
                  IBM Case Manager Stage Progress
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {caseItem.stages.map((st, idx) => (
                    <div
                      key={st.id}
                      className={`p-3 rounded-xl border text-xs ${
                        st.status === 'active'
                          ? 'border-[#97144D] bg-[#FDF1F6] dark:bg-[#2F1622]'
                          : st.status === 'completed'
                          ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'border-[#EBDCE3] dark:border-[#32222B] bg-[#FAF6F8] dark:bg-[#120D11]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-medium text-[#1D161A] dark:text-[#F5EDF1]">
                        <span>
                          0{idx + 1}. {st.label}
                        </span>
                        <span className="text-[10px] font-mono text-[#6E5D66] dark:text-[#BDAAB3] uppercase">
                          {st.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6E5D66] dark:text-[#BDAAB3] mt-1">
                        {st.completedBy ? `${st.completedBy} · ${st.completedAt}` : 'Pending step'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity Feed & Comments */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                    <MessageSquare className="w-4 h-4 text-[#97144D] dark:text-[#F48FB1]" />
                    <span>Maker–Checker Notes & Comments ({caseItem.comments.length})</span>
                  </div>

                  <form onSubmit={handlePostComment} className="flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add case remark or UCP 600 observation..."
                      className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-[#FAF6F8] dark:bg-[#120D11] text-[#1D161A] dark:text-[#F5EDF1] focus:outline-none focus:border-[#97144D]"
                    />
                    <button
                      type="submit"
                      disabled={postingComment || !commentText.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#97144D] hover:bg-[#7A0E3D] text-white text-xs font-medium disabled:opacity-40 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>
                  </form>

                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {caseItem.comments.length === 0 ? (
                      <p className="text-xs text-[#6E5D66] dark:text-[#BDAAB3] py-4 text-center">
                        No comments posted on this case yet.
                      </p>
                    ) : (
                      caseItem.comments.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-lg border border-[#F0E3E9] dark:border-[#32222B] bg-[#FAF6F8] dark:bg-[#120D11] text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 text-[#6E5D66] dark:text-[#BDAAB3]">
                            <span className="font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                              {c.author} · {c.role}
                            </span>
                            <span className="font-mono text-[11px]">{c.timestamp}</span>
                          </div>
                          <p className="text-[#4B3F46] dark:text-[#DECED6] mt-1">{c.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Audit Events */}
                <div className="p-4 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                      <Clock className="w-4 h-4 text-[#97144D] dark:text-[#F48FB1]" />
                      <span>Recent Audit Trail</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('history')}
                      className="text-xs text-[#97144D] dark:text-[#F48FB1] hover:underline cursor-pointer"
                    >
                      View all ({caseItem.auditTrail.length})
                    </button>
                  </div>

                  <div className="divide-y divide-[#F3E7ED] dark:divide-[#2E1F27] text-xs max-h-64 overflow-y-auto">
                    {caseItem.auditTrail.slice(0, 6).map((entry) => (
                      <div key={entry.id} className="py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                            {entry.event}
                          </span>
                          <span className="font-mono text-[11px] text-[#8C7A83]">
                            {entry.source} · {entry.timestamp}
                          </span>
                        </div>
                        <p className="text-[#6E5D66] dark:text-[#BDAAB3] mt-0.5">
                          {entry.actor}: {entry.details}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'documents' && (
            <div className="h-[680px]">
              <IcmDocumentViewer
                caseId={caseItem.caseId}
                lcReference={caseItem.lcReference}
                processType={caseItem.processType}
                documents={caseItem.documents}
                activeDocId={activeDocId}
                onSelectDoc={setActiveDocId}
                fields={caseItem.fields}
                onUpdateStatus={(docId, status, note) =>
                  onUpdateDocumentStatus(caseItem.caseId, docId, status, note)
                }
              />
            </div>
          )}

          {activeTab === 'fields' && (
            <div className="p-4 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                    Complete Case Property Ledger (IBM ICM + Custom DB)
                  </h2>
                  <p className="text-xs text-[#6E5D66] dark:text-[#BDAAB3]">
                    Read-only audit snapshot across both persistence stores. Open Work Step to edit and dispatch.
                  </p>
                </div>

                <div className="flex items-center p-0.5 rounded-lg bg-[#EFE0E8] dark:bg-[#2B1B24] text-xs">
                  <button
                    type="button"
                    onClick={() => setFieldSourceFilter('all')}
                    className={`px-3 py-1 rounded-md font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                      fieldSourceFilter === 'all'
                        ? 'bg-white dark:bg-[#191116] text-[#97144D] dark:text-[#F48FB1] font-semibold shadow-xs'
                        : 'text-[#6E5D66] dark:text-[#BDAAB3] hover:text-[#1D161A] dark:hover:text-[#F5EDF1]'
                    }`}
                  >
                    All Fields ({caseItem.fields.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFieldSourceFilter('ICM')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                      fieldSourceFilter === 'ICM'
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    <span>ICM Case ({metrics.icmTotal})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFieldSourceFilter('CUSTOM_DB')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                      fieldSourceFilter === 'CUSTOM_DB'
                        ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                    <span>Custom DB ({metrics.customDbTotal})</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {sections.map((sec) => (
                  <div key={sec.section} className="border border-[#EBDCE3] dark:border-[#32222B] rounded-xl overflow-hidden">
                    <div className="px-2.5 py-1.5 bg-[#FBF2F6] dark:bg-[#22151D] flex items-center justify-between text-xs font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                      <span>{sec.section}</span>
                      <span className="font-mono text-[11px] text-[#6E5D66] dark:text-[#BDAAB3]">
                        {sec.filled}/{sec.total} filled
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-[#EFE3E9] dark:bg-[#32222B] border-t border-[#EBDCE3] dark:border-[#32222B]">
                      {sec.fields.map((f) => {
                        const empty = isFieldEmpty(f.value);
                        return (
                          <div
                            key={f.id}
                            className={`px-2.5 py-1.5 text-[11.5px] ${
                              f.fullWidth ? 'col-span-full' : ''
                            } ${
                              f.required && empty
                                ? 'bg-red-50/75 dark:bg-red-950/30'
                                : 'bg-white dark:bg-[#191116]'
                            }`}
                          >
                            <div className={f.fullWidth ? 'space-y-1' : 'flex items-center justify-between gap-2'}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate text-[11px] text-[#6E5D66] dark:text-[#BDAAB3]" title={f.label}>
                                  {f.label}
                                  {f.required ? <span className="text-red-600 dark:text-red-400 font-bold ml-0.5">*</span> : null}
                                </span>
                                {f.source === 'ICM' ? (
                                  <span
                                    title={`IBM Case Manager Property: ${f.icmSymbolicName}`}
                                    className="inline-flex items-center gap-0.5 px-1 py-[1px] rounded border border-blue-200/80 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[9.5px] font-medium leading-none whitespace-nowrap shrink-0"
                                  >
                                    <Layers className="w-2.5 h-2.5" />
                                    <span>ICM</span>
                                  </span>
                                ) : (
                                  <span
                                    title={`Custom DB Column: ${f.customDbColumn}`}
                                    className="inline-flex items-center gap-0.5 px-1 py-[1px] rounded border border-teal-200/80 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-[9.5px] font-medium leading-none whitespace-nowrap shrink-0"
                                  >
                                    <Database className="w-2.5 h-2.5" />
                                    <span>DB</span>
                                  </span>
                                )}
                              </div>
                              <div
                                className={`font-medium truncate ${f.fullWidth ? 'whitespace-normal' : 'text-right'} ${
                                  empty
                                    ? 'text-red-700 dark:text-red-400 font-semibold'
                                    : 'text-[#1D161A] dark:text-[#F5EDF1]'
                                }`}
                                title={empty ? 'Missing / Empty' : f.value}
                              >
                                {empty ? 'Missing / Empty' : f.value}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="p-4 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] space-y-3">
              <h2 className="text-sm font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                Linked Case Tasks & Sub-Workflows ({caseItem.tasks.length})
              </h2>
              {caseItem.tasks.length === 0 ? (
                <p className="text-xs text-[#6E5D66] dark:text-[#BDAAB3] py-6 text-center">
                  No parallel sub-tasks created for this LC case.
                </p>
              ) : (
                <div className="divide-y divide-[#F3E7ED] dark:divide-[#2E1F27] text-xs">
                  {caseItem.tasks.map((t) => (
                    <div key={t.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-[#1D161A] dark:text-[#F5EDF1]">{t.title}</div>
                        <div className="text-[#6E5D66] dark:text-[#BDAAB3] mt-0.5">
                          Role: {t.assignedRole} · Assignee: {t.assignee}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-medium text-[#3E3239] dark:text-[#DECED6]">{t.status}</div>
                        <div className="text-[11px] text-[#6E5D66]">Due {t.dueDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-4 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] space-y-3">
              <h2 className="text-sm font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                Complete Audit Log ({caseItem.auditTrail.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#EBDCE3] dark:border-[#32222B] text-[#6E5D66] dark:text-[#BDAAB3]">
                      <th className="py-2 pr-4">Timestamp</th>
                      <th className="py-2 pr-4">Source</th>
                      <th className="py-2 pr-4">Actor</th>
                      <th className="py-2 pr-4">Event</th>
                      <th className="py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3E7ED] dark:divide-[#2E1F27]">
                    {caseItem.auditTrail.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-4 font-mono whitespace-nowrap text-[#6E5D66]">{a.timestamp}</td>
                        <td className="py-2 pr-4 font-mono whitespace-nowrap text-[#4B3F46] dark:text-[#DECED6]">{a.source}</td>
                        <td className="py-2 pr-4 whitespace-nowrap text-[#1D161A] dark:text-[#F5EDF1]">{a.actor}</td>
                        <td className="py-2 pr-4 font-medium whitespace-nowrap text-[#1D161A] dark:text-[#F5EDF1]">{a.event}</td>
                        <td className="py-2 text-[#6E5D66] dark:text-[#BDAAB3]">{a.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'related' && (
            <div className="p-4 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] space-y-3">
              <h2 className="text-sm font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                Related Letters of Credit, Amendments & Drawings ({caseItem.relatedCases.length})
              </h2>
              {caseItem.relatedCases.length === 0 ? (
                <p className="text-xs text-[#6E5D66] dark:text-[#BDAAB3] py-6 text-center">
                  No related LC cases linked.
                </p>
              ) : (
                <div className="divide-y divide-[#F3E7ED] dark:divide-[#2E1F27] text-xs">
                  {caseItem.relatedCases.map((rel) => (
                    <div key={rel.caseId} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-mono font-bold text-[#97144D] dark:text-[#F48FB1]">
                          {rel.lcReference} · {rel.caseId}
                        </div>
                        <div className="text-[#4B3F46] dark:text-[#DECED6] mt-0.5">
                          {rel.relationship} · {rel.processType}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                          {rel.amountFormatted}
                        </div>
                        <div className="text-[11px] text-[#6E5D66]">{rel.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
