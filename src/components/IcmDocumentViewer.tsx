import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCode2,
  FileText,
  Maximize2,
  Minimize2,
  RotateCw,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { CaseFieldDefinition, DocumentVerificationStatus, IcmDocument } from '../types/icm';
import { isFieldEmpty } from '../utils/fieldMetrics';

interface IcmDocumentViewerProps {
  caseId: string;
  lcReference: string;
  processType?: string;
  documents: IcmDocument[];
  activeDocId: string;
  onSelectDoc: (docId: string) => void;
  highlightedKey?: string | null;
  onUpdateStatus: (
    docId: string,
    status: DocumentVerificationStatus,
    note: string
  ) => Promise<void>;
  fields?: CaseFieldDefinition[];
  fieldValues?: Record<string, string>;
  onSelectFieldKey?: (field: CaseFieldDefinition) => void;
}

export const IcmDocumentViewer: React.FC<IcmDocumentViewerProps> = ({
  caseId,
  lcReference,
  processType,
  documents,
  activeDocId,
  onSelectDoc,
  highlightedKey,
  onUpdateStatus,
  fields,
  fieldValues,
  onSelectFieldKey,
}) => {
  const [viewerTab, setViewerTab] = useState<'documents' | 'swift'>('documents');
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [docSearch, setDocSearch] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [discrepancyDraft, setDiscrepancyDraft] = useState<string>('');
  const [showDiscrepancyBox, setShowDiscrepancyBox] = useState<boolean>(false);
  const [savingStatus, setSavingStatus] = useState<boolean>(false);
  const [showViewOneInfo, setShowViewOneInfo] = useState<boolean>(false);

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId) || documents[0],
    [documents, activeDocId]
  );

  const swiftFields = useMemo(() => {
    if (!fields) return [];
    return fields
      .filter((f) => Boolean(f.swiftTag))
      .map((f) => ({
        ...f,
        value:
          fieldValues && Object.prototype.hasOwnProperty.call(fieldValues, f.key)
            ? fieldValues[f.key]
            : f.value,
      }));
  }, [fields, fieldValues]);

  const swiftMessageType = useMemo(() => {
    if (!processType) return 'MT700';
    if (processType.includes('MT707') || processType.includes('Amendment')) return 'MT707';
    if (processType.includes('Standby')) return 'MT760';
    return 'MT700';
  }, [processType]);

  const handleDownload = () => {
    if (viewerTab === 'swift' && swiftFields.length > 0) {
      const swiftLines = [
        `{1:F01MERIDIANXXXX0000000000}{2:I${swiftMessageType.replace('MT', '')}ADVISINGXXXXN}{4:`,
        ...swiftFields.map((f) => `${f.swiftTag}${isFieldEmpty(f.value) ? '[MISSING]' : f.value}`),
        '-}',
      ].join('\n');
      const blob = new Blob([swiftLines], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${lcReference}_${swiftMessageType}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!activeDoc) return;
    const textLines = [
      `IBM FileNet Document Export — ${activeDoc.title}`,
      `Case ID: ${caseId} | LC Reference: ${lcReference}`,
      `Document Class: ${activeDoc.docClass} | Status: ${activeDoc.verificationStatus}`,
      '',
      ...activeDoc.previewSections.flatMap((sec) => [
        `=== ${sec.heading} ===`,
        ...sec.rows.map((r) => `${r.label}: ${r.value}`),
        '',
      ]),
    ].join('\n');

    const blob = new Blob([textLines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDoc.title.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleStatusChange = async (status: DocumentVerificationStatus) => {
    if (!activeDoc) return;
    setSavingStatus(true);
    try {
      await onUpdateStatus(activeDoc.id, status, status === 'Discrepancy' ? discrepancyDraft : '');
      setShowDiscrepancyBox(false);
    } finally {
      setSavingStatus(false);
    }
  };

  if (!activeDoc) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
        No FileNet documents attached to this case yet.
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-white dark:bg-[#191116] border border-[#EBDCE3] dark:border-[#32222B] rounded-2xl overflow-hidden shadow-[0_6px_22px_-14px_rgba(151,20,77,0.16)] ${
        isExpanded ? 'fixed inset-4 z-50 shadow-2xl' : 'h-full'
      }`}
    >
      {/* Top Mode Switcher: FileNet Documents vs Live SWIFT MT Preview */}
      <div className="border-b border-[#EBDCE3] dark:border-[#32222B] bg-[#FBF2F6] dark:bg-[#22151D] px-3 py-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center p-0.5 rounded-lg bg-[#EFE0E8] dark:bg-[#2B1B24] text-xs">
            <button
              type="button"
              onClick={() => setViewerTab('documents')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                viewerTab === 'documents'
                  ? 'bg-white dark:bg-[#191116] text-[#97144D] dark:text-[#F48FB1] font-semibold shadow-xs'
                  : 'text-[#6E5D66] dark:text-[#BDAAB3] hover:text-[#1D161A] dark:hover:text-[#F5EDF1]'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#97144D] dark:text-[#F48FB1]" />
              <span>FileNet Docs ({documents.length})</span>
            </button>
            {fields && fields.length > 0 && (
              <button
                type="button"
                onClick={() => setViewerTab('swift')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  viewerTab === 'swift'
                    ? 'bg-white dark:bg-[#191116] text-[#97144D] dark:text-[#F48FB1] font-semibold shadow-xs'
                    : 'text-[#6E5D66] dark:text-[#BDAAB3] hover:text-[#1D161A] dark:hover:text-[#F5EDF1]'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                <span>SWIFT {swiftMessageType} Draft</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {viewerTab === 'documents' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowViewOneInfo((v) => !v)}
                  className="font-medium text-[#97144D] dark:text-[#F48FB1] hover:underline cursor-pointer"
                >
                  {showViewOneInfo ? 'Hide Daeja Hook' : 'Daeja ViewONE'}
                </button>
                <span className="text-[#D4BEC8] dark:text-[#4E3844]">·</span>
                <span className="font-mono tabular-nums text-[#6E5D66] dark:text-[#BDAAB3]">
                  {activeDoc.pageCount} pg · {activeDoc.sizeLabel}
                </span>
              </>
            )}
            {viewerTab === 'swift' && (
              <span className="font-mono tabular-nums text-[#6E5D66] dark:text-[#BDAAB3]">
                {swiftFields.length} SWIFT tags mapped
              </span>
            )}
          </div>
        </div>

        {viewerTab === 'documents' && showViewOneInfo && (
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-mono text-slate-600 dark:text-slate-300 space-y-0.5">
            <div>
              ICM Daeja ViewONE Mount: <span className="text-slate-900 dark:text-slate-100">docId={activeDoc.id}</span>
            </div>
            <div>
              FileNet ObjectStore: <span className="text-slate-900 dark:text-slate-100">TF_TARGET_OS</span> · Class:{' '}
              <span className="text-slate-900 dark:text-slate-100">{activeDoc.docClass}</span>
            </div>
          </div>
        )}

        {viewerTab === 'documents' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {documents.map((doc) => {
              const active = doc.id === activeDoc.id;
              const statusColor =
                doc.verificationStatus === 'Verified'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : doc.verificationStatus === 'Discrepancy'
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-amber-700 dark:text-amber-400';

              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onSelectDoc(doc.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#FDF1F6] dark:bg-[#2F1622] border-[#97144D] dark:border-[#D81B60] text-[#97144D] dark:text-[#F48FB1] font-semibold shadow-xs'
                      : 'bg-white/80 dark:bg-[#191116] border-[#E7D8DF] dark:border-[#3A2732] text-[#5E4E56] dark:text-[#CBBCC4] hover:bg-white dark:hover:bg-[#281820]'
                  }`}
                >
                  <span className="truncate max-w-[165px]">{doc.title}</span>
                  <span className={`text-[10px] font-medium ${statusColor}`}>{doc.verificationStatus}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116]">
        <div className="flex items-center gap-1">
          {viewerTab === 'documents' && (
            <>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(70, z - 10))}
                aria-label="Zoom out"
                className="p-1.5 rounded-md border border-[#E7D8DF] dark:border-[#3A2732] text-[#5E4E56] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-xs font-mono tabular-nums text-[#4B3F46] dark:text-[#DECED6]">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(150, z + 10))}
                aria-label="Zoom in"
                className="p-1.5 rounded-md border border-[#E7D8DF] dark:border-[#3A2732] text-[#5E4E56] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                aria-label="Rotate document"
                className="p-1.5 rounded-md border border-[#E7D8DF] dark:border-[#3A2732] text-[#5E4E56] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleDownload}
            aria-label={viewerTab === 'swift' ? 'Download SWIFT MT draft' : 'Download document'}
            title={viewerTab === 'swift' ? 'Download SWIFT MT draft' : 'Download document'}
            className="p-1.5 rounded-md border border-[#E7D8DF] dark:border-[#3A2732] text-[#5E4E56] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? 'Exit fullscreen viewer' : 'Expand viewer'}
            className="p-1.5 rounded-md border border-[#E7D8DF] dark:border-[#3A2732] text-[#5E4E56] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] cursor-pointer"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {viewerTab === 'documents' ? (
          <>
            <div className="relative flex-1 max-w-[190px]">
              <Search className="w-3.5 h-3.5 text-[#9B8591] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Find in doc..."
                className="w-full pl-7 pr-2 py-1 text-xs rounded-md border border-[#E7D8DF] dark:border-[#3A2732] bg-[#FAF6F8] dark:bg-[#120D11] text-[#1D161A] dark:text-[#F5EDF1] placeholder:text-[#9B8591] focus:outline-none focus:border-[#97144D]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={savingStatus}
                onClick={() => handleStatusChange('Verified')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeDoc.verificationStatus === 'Verified'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verify</span>
              </button>
              <button
                type="button"
                disabled={savingStatus}
                onClick={() => setShowDiscrepancyBox((v) => !v)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeDoc.verificationStatus === 'Discrepancy'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-950/40'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Discrepancy</span>
              </button>
            </div>
          </>
        ) : (
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Click any SWIFT tag row below to jump to & edit that field
          </div>
        )}
      </div>

      {/* Discrepancy Input Drawer */}
      {viewerTab === 'documents' && (showDiscrepancyBox || activeDoc.discrepancyNote) && (
        <div className="px-3 py-2 border-b border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-xs">
          {activeDoc.discrepancyNote && !showDiscrepancyBox ? (
            <div className="flex items-center justify-between gap-2 text-red-800 dark:text-red-300">
              <span>
                <strong>Discrepancy Logged:</strong> {activeDoc.discrepancyNote}
              </span>
              <button
                type="button"
                onClick={() => {
                  setDiscrepancyDraft(activeDoc.discrepancyNote || '');
                  setShowDiscrepancyBox(true);
                }}
                className="underline font-medium shrink-0 cursor-pointer"
              >
                Edit Note
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={discrepancyDraft}
                onChange={(e) => setDiscrepancyDraft(e.target.value)}
                placeholder="Describe UCP 600 discrepancy (e.g., Late shipment, Consignee mismatch)..."
                className="flex-1 px-2.5 py-1 rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                disabled={savingStatus || !discrepancyDraft.trim()}
                onClick={() => handleStatusChange('Discrepancy')}
                className="px-3 py-1 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                Save Flag
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Canvas */}
      {viewerTab === 'documents' ? (
        <div className="flex-1 overflow-auto bg-[#F4EAEF] dark:bg-[#120D11] p-4">
          <div
            className="mx-auto max-w-[680px] bg-white dark:bg-[#191116] border border-[#EBDCE3] dark:border-[#32222B] rounded-xl shadow-xs p-6 transition-transform origin-top"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            }}
          >
            {/* Document Header */}
            <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-[#EFE3E9] dark:border-[#32222B]">
              <div>
                <p className="text-[11px] font-medium text-[#6E5D66] dark:text-[#BDAAB3]">
                  {activeDoc.docClass} · FileNet Repository
                </p>
                <h4 className="text-base font-semibold text-[#1D161A] dark:text-[#F5EDF1] mt-0.5">
                  {activeDoc.title}
                </h4>
                <p className="text-xs text-[#6E5D66] dark:text-[#BDAAB3] mt-0.5">
                  Added {activeDoc.addedAt} by {activeDoc.addedBy}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-semibold text-[#97144D] dark:text-[#F48FB1]">
                  {lcReference}
                </span>
                <div
                  className={`text-xs font-medium mt-1 ${
                    activeDoc.verificationStatus === 'Verified'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : activeDoc.verificationStatus === 'Discrepancy'
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {activeDoc.verificationStatus}
                </div>
              </div>
            </div>

            {/* Uploaded Native Document Preview (Images, PDF, or Text streams filed in FileNet) */}
            {activeDoc.contentDataUrl && activeDoc.mimeType.startsWith('image/') && (
              <div className="mb-4 rounded-lg border border-[#EBDCE3] dark:border-[#32222B] overflow-hidden bg-[#FAF6F8] dark:bg-[#120D11] p-2">
                <img
                  src={activeDoc.contentDataUrl}
                  alt={activeDoc.title}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-96 mx-auto object-contain rounded"
                />
              </div>
            )}

            {activeDoc.contentDataUrl && activeDoc.mimeType === 'application/pdf' && (
              <div className="mb-4 rounded-lg border border-[#EBDCE3] dark:border-[#32222B] overflow-hidden bg-[#FAF6F8] dark:bg-[#120D11]">
                <iframe
                  title={activeDoc.title}
                  src={activeDoc.contentDataUrl}
                  className="w-full h-80 border-0"
                />
              </div>
            )}

            {activeDoc.textPreview && (
              <div className="mb-4 rounded-lg border border-[#EBDCE3] dark:border-[#32222B] bg-[#FAF6F8] dark:bg-[#120D11] p-3">
                <div className="text-[11px] font-semibold text-[#5E4E56] dark:text-[#DECED6] mb-1.5">
                  FileNet Content Preview
                </div>
                <pre className="text-[11px] font-mono text-[#1D161A] dark:text-[#F5EDF1] whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                  {activeDoc.textPreview}
                </pre>
              </div>
            )}

            {/* Document Body Clauses */}
            <div className="space-y-5">
              {activeDoc.previewSections.map((section) => (
                <div key={section.heading}>
                  <h5 className="text-xs font-semibold text-[#97144D] dark:text-[#F48FB1] pb-1.5 mb-2 border-b border-[#F3E7ED] dark:border-[#2E1F27]">
                    {section.heading}
                  </h5>
                  <div className="divide-y divide-[#F6ECF1] dark:divide-[#2B1C24]">
                    {section.rows.map((row) => {
                      const matchesFieldHighlight =
                        highlightedKey && row.highlightKey && highlightedKey === row.highlightKey;
                      const matchesSearch =
                        docSearch.trim() !== '' &&
                        (`${row.label} ${row.value}`)
                          .toLowerCase()
                          .includes(docSearch.trim().toLowerCase());

                      return (
                        <div
                          key={row.label}
                          className={`grid grid-cols-12 gap-3 py-2 px-2 rounded transition-colors text-xs ${
                            matchesFieldHighlight
                              ? 'bg-[#FDF1F6] dark:bg-[#2F1622] ring-1 ring-[#97144D]/45'
                              : matchesSearch
                              ? 'bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-400/50'
                              : ''
                          }`}
                        >
                          <div className="col-span-5 text-[#6E5D66] dark:text-[#BDAAB3] font-medium">
                            {row.label}
                          </div>
                          <div className="col-span-7 font-mono text-[#1D161A] dark:text-[#F5EDF1] break-words">
                            {row.value}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-[#160D12] text-[#F5EDF1] p-4 font-mono text-xs space-y-3">
          <div className="p-3 rounded-lg border border-[#3B2330] bg-[#21121A] text-[#E6CED9] space-y-1">
            <div>{`{1:F01MERIDIANXXXX0000000000}`}</div>
            <div>{`{2:I${swiftMessageType.replace('MT', '')}ADVISINGXXXXN}`}</div>
            <div>{`{4: — Live Outbound ${swiftMessageType} Payload for ${lcReference}`}</div>
          </div>

          <div className="rounded-lg border border-[#3B2330] bg-[#1D1017] divide-y divide-[#311D27]">
            {swiftFields.map((f) => {
              const empty = isFieldEmpty(f.value);
              const missingMandatory = f.required && empty;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectFieldKey?.(f)}
                  className={`w-full text-left px-3 py-2 flex items-start gap-3 transition-colors cursor-pointer ${
                    missingMandatory
                      ? 'bg-red-950/40 hover:bg-red-950/60'
                      : 'hover:bg-[#2A1721]'
                  }`}
                >
                  <span className="text-[#F48FB1] font-semibold shrink-0 w-12">{f.swiftTag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-sans text-[#BDAAB3]">
                      {f.label} ({f.source === 'ICM' ? 'ICM Case' : 'Custom DB'})
                    </div>
                    <div
                      className={`mt-0.5 break-words ${
                        missingMandatory
                          ? 'text-red-400 font-semibold'
                          : empty
                          ? 'text-[#7F6B75]'
                          : 'text-[#F5EDF1]'
                      }`}
                    >
                      {empty ? (f.required ? '[MISSING MANDATORY SWIFT FIELD — CLICK TO FILL]' : '—') : f.value}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="text-[#BDAAB3] px-1">{'-}'}</div>
        </div>
      )}
    </div>
  );
};
