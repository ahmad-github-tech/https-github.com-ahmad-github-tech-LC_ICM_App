import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Database,
  FilePlus2,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { icmApi } from '../services/icmApi';
import type {
  CreateCaseDocumentInput,
  IcmWorkItem,
  IntakeConfigResponse,
  IntakeFieldConfig,
} from '../types/icm';
import { cn } from '../utils/cn';

interface AddCaseModalProps {
  isOpen: boolean;
  actorName: string;
  onClose: () => void;
  onCaseCreated: (created: IcmWorkItem) => void;
}

interface StagedUploadDoc extends CreateCaseDocumentInput {
  id: string;
}

function readFileForViewer(file: File, defaultDocClass: string): Promise<StagedUploadDoc> {
  return new Promise((resolve) => {
    const id = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const isText =
      file.type.startsWith('text/') ||
      /\.(txt|csv|swift|mt|json|xml)$/i.test(file.name);
    const isPreviewableBinary =
      file.type.startsWith('image/') || file.type === 'application/pdf';

    if (isText && file.size <= 512 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id,
          fileName: file.name,
          mimeType: file.type || 'text/plain',
          sizeBytes: file.size,
          docClass: defaultDocClass,
          textPreview: typeof reader.result === 'string' ? reader.result.slice(0, 12000) : undefined,
        });
      };
      reader.onerror = () =>
        resolve({
          id,
          fileName: file.name,
          mimeType: file.type || 'text/plain',
          sizeBytes: file.size,
          docClass: defaultDocClass,
        });
      reader.readAsText(file);
      return;
    }

    if (isPreviewableBinary && file.size <= 8 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          sizeBytes: file.size,
          docClass: defaultDocClass,
          contentDataUrl: typeof reader.result === 'string' ? reader.result : undefined,
        });
      };
      reader.onerror = () =>
        resolve({
          id,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          docClass: defaultDocClass,
        });
      reader.readAsDataURL(file);
      return;
    }

    resolve({
      id,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      docClass: defaultDocClass,
    });
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = Math.round(bytes / 1024);
  if (kb < 1024) return `${kb} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AddCaseModal: React.FC<AddCaseModalProps> = ({
  isOpen,
  actorName,
  onClose,
  onCaseCreated,
}) => {
  const [config, setConfig] = useState<IntakeConfigResponse | null>(null);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [wid, setWid] = useState<string>('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [touchedErrors, setTouchedErrors] = useState<Record<string, string>>({});
  const [stagedDocs, setStagedDocs] = useState<StagedUploadDoc[]>([]);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadConfig = async () => {
    setLoadingConfig(true);
    setConfigError(null);
    try {
      const res = await icmApi.getIntakeConfig();
      setConfig(res);
      setWid(res.generatedWid);
      const defaults: Record<string, string> = {};
      for (const f of res.fields) {
        defaults[f.key] = f.type === 'select' && f.options.length > 0 ? f.options[0] : '';
      }
      setValues(defaults);
      setTouchedErrors({});
      setStagedDocs([]);
      setSubmitError(null);
    } catch (err) {
      setConfigError(
        err instanceof Error ? err.message : 'Unable to load intake properties configuration'
      );
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, submitting, onClose]);

  const mandatoryStats = useMemo(() => {
    if (!config) return { total: 0, filled: 0 };
    const reqFields = config.fields.filter((f) => f.required);
    const filled = reqFields.filter((f) => (values[f.key] || '').trim().length > 0).length;
    return { total: reqFields.length, filled };
  }, [config, values]);

  if (!isOpen) return null;

  const handleFieldChange = (field: IntakeFieldConfig, nextVal: string) => {
    setValues((prev) => ({ ...prev, [field.key]: nextVal }));
    if (touchedErrors[field.key] && nextVal.trim()) {
      setTouchedErrors((prev) => {
        const copy = { ...prev };
        delete copy[field.key];
        return copy;
      });
    }
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const defaultClass = config?.documentClasses?.[0] || 'LC Application Form';
    const loaded = await Promise.all(
      Array.from(fileList).map((file) => readFileForViewer(file, defaultClass))
    );
    setStagedDocs((prev) => [...prev, ...loaded]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRegenerateWid = async () => {
    try {
      const res = await icmApi.getIntakeConfig();
      setWid(res.generatedWid);
    } catch {
      const min = 100000;
      const max = 899999;
      setWid(String(min + Math.floor(Math.random() * max)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    const nextErrors: Record<string, string> = {};
    for (const f of config.fields) {
      if (f.required && !(values[f.key] || '').trim()) {
        nextErrors[f.key] = `${f.label} is mandatory`;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setTouchedErrors(nextErrors);
      setSubmitError('Please fill all mandatory fields configured in case-intake.properties.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await icmApi.createCase({
        wid,
        fields: values,
        documents: stagedDocs.map(({ id: _id, ...doc }) => doc),
        actor: actorName,
      });
      onCaseCreated(created);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'IBM ICM Case Creation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-case-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-5 overflow-y-auto"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-[#EBDCE3] dark:border-[#3A2732] bg-white dark:bg-[#191116] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#EBDCE3] dark:border-[#32222B] bg-gradient-to-r from-[#FDF1F6] via-[#FAF5F7] to-white dark:from-[#26141D] dark:to-[#191116] flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6B5A63] dark:text-[#B9A7B0]">
              <span className="font-semibold text-[#97144D] dark:text-[#F48FB1]">
                IBM ICM Case Creation
              </span>
              <span aria-hidden="true">·</span>
              <span>Schema loaded from case-intake.properties</span>
              {config && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Target Role:{' '}
                    <strong className="font-mono text-[#1D161A] dark:text-[#F5EDF1]">
                      {config.roleConfig.roleName}
                    </strong>
                  </span>
                </>
              )}
            </div>
            <h2
              id="add-case-modal-title"
              className="text-base font-bold text-[#1D161A] dark:text-[#F5EDF1] mt-0.5"
            >
              Add New Letter of Credit Case
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close Add Case dialog"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {loadingConfig ? (
          <div className="p-8 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-blue-700 dark:text-blue-400" />
            <span>Loading intake roles, fields, and generating 6-digit WID...</span>
          </div>
        ) : configError ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{configError}</p>
            <button
              type="button"
              onClick={loadConfig}
              className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-medium hover:bg-blue-800 cursor-pointer"
            >
              Retry Loading Config
            </button>
          </div>
        ) : config ? (
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Auto-generated 6-digit WID & Maker Stage Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-medium text-[#6B5A63] dark:text-[#B9A7B0]">
                    Auto-Generated WID ({config.roleConfig.widDigits}-Digit)
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono tabular-nums text-base font-bold tracking-wider text-[#97144D] dark:text-[#F48FB1]">
                      {wid}
                    </span>
                    <button
                      type="button"
                      onClick={handleRegenerateWid}
                      title="Regenerate 6-digit WID"
                      className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Passed to ICM CaseCreation &amp; saved in DB
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Destination Stage (Maker)
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {config.roleConfig.stepName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                    In-Basket: {config.roleConfig.inBasketId}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    ICM Solution Case Type
                  </div>
                  <div className="mt-1 text-xs font-semibold font-mono text-slate-900 dark:text-slate-100">
                    {config.roleConfig.caseType}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Initial Owner: {config.roleConfig.defaultAssignee}
                  </div>
                </div>
              </div>

              {/* Configurable Properties-Driven Case Fields */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Case Creation Attributes ({config.fields.length} Configured Fields)
                  </h3>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    Mandatory Ready: {mandatoryStats.filled}/{mandatoryStats.total}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {config.fields.map((field) => {
                    const err = touchedErrors[field.key];
                    const val = values[field.key] ?? '';
                    const isIcm = field.source === 'ICM';

                    return (
                      <div key={field.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor={`intake-field-${field.key}`}
                            className="text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1"
                          >
                            <span>{field.label}</span>
                            {field.required && (
                              <span className="text-red-600 dark:text-red-400 font-bold" title="Mandatory">
                                *
                              </span>
                            )}
                          </label>

                          <span
                            title={
                              isIcm
                                ? `IBM ICM Property: ${field.symbolicName}`
                                : `Custom DB Column: ${field.dbColumn || field.key}`
                            }
                            className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap',
                              isIcm
                                ? 'text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-950/30'
                                : 'text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/30'
                            )}
                          >
                            {isIcm ? (
                              <Layers className="w-2.5 h-2.5" />
                            ) : (
                              <Database className="w-2.5 h-2.5" />
                            )}
                            <span>{isIcm ? 'ICM' : 'DB'}</span>
                          </span>
                        </div>

                        {field.type === 'select' ? (
                          <select
                            id={`intake-field-${field.key}`}
                            value={val}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            className={cn(
                              'w-full h-9 px-2.5 text-xs rounded-lg border bg-white dark:bg-[#120D11] text-[#1D161A] dark:text-[#F5EDF1] focus:outline-none focus:border-[#97144D]',
                              err
                                ? 'border-red-500 dark:border-red-500'
                                : 'border-[#DECED6] dark:border-[#3A2732]'
                            )}
                          >
                            <option value="">{field.placeholder || `Select ${field.label}`}</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={`intake-field-${field.key}`}
                            type={
                              field.type === 'number'
                                ? 'number'
                                : field.type === 'date'
                                ? 'date'
                                : 'text'
                            }
                            value={val}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            placeholder={field.placeholder || `Enter ${field.label}`}
                            className={cn(
                              'w-full h-9 px-2.5 text-xs rounded-lg border bg-white dark:bg-[#120D11] text-[#1D161A] dark:text-[#F5EDF1] placeholder:text-[#9E8B95] focus:outline-none focus:border-[#97144D]',
                              err
                                ? 'border-red-500 dark:border-red-500'
                                : 'border-[#DECED6] dark:border-[#3A2732]'
                            )}
                          />
                        )}

                        <div className="flex items-center justify-between text-[10px]">
                          {err ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">{err}</span>
                          ) : (
                            <span className="font-mono text-slate-400 dark:text-slate-500">
                              {field.symbolicName} · {field.required ? 'Mandatory' : 'Optional'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Document Browser (FileNet CE Ingestion) */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Browse &amp; Attach FileNet Documents (Single or Multiple)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Attached files are filed into the IBM ICM Case folder via FileNetDocumentService and viewable immediately at Maker Stage.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DECED6] dark:border-[#3A2732] bg-white dark:bg-[#23171E] text-xs font-medium text-[#1D161A] dark:text-[#F5EDF1] hover:bg-[#FDF2F7] dark:hover:bg-[#311A26] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#97144D] dark:text-[#F48FB1]" />
                    <span>Browse Files</span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.txt,.doc,.docx,.csv,.xml"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFilesSelected(e.dataTransfer.files);
                  }}
                  className={cn(
                    'rounded-lg border border-dashed transition-colors p-3',
                    dragOver
                      ? 'border-[#97144D] bg-[#FDF1F6] dark:bg-[#3A1426]/40'
                      : 'border-[#DECED6] dark:border-[#3A2732] bg-[#FBF7F9] dark:bg-[#120D11]'
                  )}
                >
                  {stagedDocs.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer"
                    >
                      <FilePlus2 className="w-5 h-5 text-slate-400" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Click to browse or drag &amp; drop one or multiple PDF, image, or text files
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Supports multi-select batch attachment into FileNet ObjectStore
                      </span>
                    </button>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {stagedDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                {doc.fileName}
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                {formatFileSize(doc.sizeBytes)} · {doc.mimeType}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              aria-label={`Document class for ${doc.fileName}`}
                              value={doc.docClass}
                              onChange={(e) => {
                                const nextClass = e.target.value;
                                setStagedDocs((prev) =>
                                  prev.map((d) =>
                                    d.id === doc.id ? { ...d, docClass: nextClass } : d
                                  )
                                );
                              }}
                              className="h-7 px-2 text-[11px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                            >
                              {config.documentClasses.map((cls) => (
                                <option key={cls} value={cls}>
                                  {cls}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() =>
                                setStagedDocs((prev) => prev.filter((d) => d.id !== doc.id))
                              }
                              aria-label={`Remove ${doc.fileName}`}
                              className="p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {submitError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#EBDCE3] dark:border-[#32222B] bg-[#FAF5F7] dark:bg-[#150E12] flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-[#6B5A63] dark:text-[#B9A7B0] font-mono tabular-nums">
                WID {wid} · {stagedDocs.length} doc(s) queued · Maker Stage: {config.roleConfig.inBasketId}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-3.5 py-2 rounded-lg border border-[#E7D8DF] dark:border-[#3B2833] bg-white dark:bg-[#23171E] text-xs font-medium text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#311A26] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#97144D] hover:bg-[#7A0E3D] text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {submitting ? 'Creating Case in IBM ICM...' : 'Create Case in IBM ICM'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
};
