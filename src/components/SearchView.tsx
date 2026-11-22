import React, { useMemo, useState } from 'react';
import { FolderOpen, Play, Search } from 'lucide-react';
import type { IcmWorkItem } from '../types/icm';
import { computeFieldMetrics } from '../utils/fieldMetrics';

interface SearchViewProps {
  allCases: IcmWorkItem[];
  onOpenWorkItem: (wobNum: string) => void;
  onOpenCase360: (caseId: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  allCases,
  onOpenWorkItem,
  onOpenCase360,
}) => {
  const [query, setQuery] = useState<string>('');
  const [processFilter, setProcessFilter] = useState<string>('all');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCases.filter((item) => {
      if (processFilter !== 'all' && item.processType !== processFilter) return false;
      if (!q) return true;
      const fieldHaystack = item.fields.map((f) => `${f.label} ${f.value}`).join(' ');
      return [
        item.lcReference,
        item.caseId,
        item.wobNum,
        item.applicantName,
        item.beneficiaryName,
        item.advisingBank,
        item.subject,
        fieldHaystack,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [allCases, query, processFilter]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#1D161A] dark:text-[#F5EDF1]">
          <span className="text-[#97144D] dark:text-[#F48FB1]">Search</span> Letter of Credit &amp; Documents
        </h1>
        <p className="text-xs text-[#6E5D66] dark:text-[#BDAAB3] mt-0.5">
          Search across IBM Case Manager core properties, Custom DB attributes, SWIFT BICs, and counterparties.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#9B8591] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by LC Ref (ILC-MUM-26-00418), Applicant, Beneficiary, SWIFT BIC, or HS Code..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-[#1D161A] dark:text-[#F5EDF1] placeholder:text-[#9B8591] focus:outline-none focus:border-[#97144D]"
          />
        </div>
        <select
          value={processFilter}
          onChange={(e) => setProcessFilter(e.target.value)}
          className="px-3 py-2.5 text-xs rounded-xl border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-[#1D161A] dark:text-[#F5EDF1] focus:outline-none focus:border-[#97144D]"
        >
          <option value="all">All LC Processes</option>
          <option value="Import LC Issuance">Import LC Issuance</option>
          <option value="LC Amendment (MT707)">LC Amendment (MT707)</option>
          <option value="Document Examination">Document Examination</option>
          <option value="Standby LC / BG">Standby LC / BG</option>
        </select>
      </div>

      <div className="rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] shadow-[0_6px_22px_-14px_rgba(151,20,77,0.16)] divide-y divide-[#F3E7ED] dark:divide-[#2E1F27] overflow-hidden">
        {results.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#6E5D66] dark:text-[#BDAAB3]">
            No Letter of Credit cases matched &ldquo;{query}&rdquo;.
          </div>
        ) : (
          results.map((item) => {
            const m = computeFieldMetrics(item.fields);
            return (
              <div
                key={item.caseId}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FDF4F8] dark:hover:bg-[#24161E] transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-[#97144D] dark:text-[#F48FB1]">
                      {item.lcReference}
                    </span>
                    <span className="text-[#D4BEC8] dark:text-[#4E3844]">·</span>
                    <span className="font-mono text-[#6E5D66] dark:text-[#BDAAB3]">{item.caseId}</span>
                    <span className="text-[#D4BEC8] dark:text-[#4E3844]">·</span>
                    <span className="font-medium text-[#4B3F46] dark:text-[#DECED6]">
                      {item.processType}
                    </span>
                    <span className="text-[#D4BEC8] dark:text-[#4E3844]">·</span>
                    <span className="font-mono tabular-nums font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                      {item.amountFormatted}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-[#1D161A] dark:text-[#F5EDF1] truncate">
                    {item.subject}
                  </div>
                  <div className="text-xs text-[#6E5D66] dark:text-[#BDAAB3]">
                    Applicant: {item.applicantName} · Beneficiary: {item.beneficiaryName} ·{' '}
                    <span className={m.mandatoryEmpty > 0 ? 'text-red-700 dark:text-red-400 font-medium' : 'text-emerald-700 dark:text-emerald-400 font-medium'}>
                      {m.filled}/{m.total} filled ({m.mandatoryEmpty} mandatory empty)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenWorkItem(item.wobNum)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#97144D] hover:bg-[#7A0E3D] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Open Work</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenCase360(item.caseId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] text-xs font-medium text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-[#97144D] dark:text-[#F48FB1]" />
                    <span>Case 360</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
