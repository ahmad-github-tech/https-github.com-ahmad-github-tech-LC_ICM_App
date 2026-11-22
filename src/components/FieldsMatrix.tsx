import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  Layers,
  Search,
} from 'lucide-react';
import type { CaseFieldDefinition } from '../types/icm';
import { groupFieldsBySection, isFieldEmpty } from '../utils/fieldMetrics';

export type FieldFilterMode = 'all' | 'mandatory-empty' | 'empty' | 'attention' | 'filled';
export type FieldSourceFilter = 'all' | 'ICM' | 'CUSTOM_DB';
export type ColumnLayoutMode = 'auto' | '1' | '2' | '3';

interface FieldsMatrixProps {
  fields: CaseFieldDefinition[];
  fieldValues: Record<string, string>;
  onChangeField: (key: string, value: string) => void;
  onFocusField?: (field: CaseFieldDefinition) => void;
  highlightedFieldKey: string | null;
  filterMode: FieldFilterMode;
  onFilterModeChange: (mode: FieldFilterMode) => void;
  sourceFilter: FieldSourceFilter;
  onSourceFilterChange: (source: FieldSourceFilter) => void;
  collapsedSections: Set<string>;
  onToggleSection: (section: string) => void;
  onExpandSection: (section: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  density: 'compact' | 'comfortable';
  onDensityChange: (d: 'compact' | 'comfortable') => void;
  columns: ColumnLayoutMode;
  onColumnsChange: (c: ColumnLayoutMode) => void;
}

function toSectionId(section: string): string {
  return `section-${section.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export const FieldsMatrix: React.FC<FieldsMatrixProps> = ({
  fields,
  fieldValues,
  onChangeField,
  onFocusField,
  highlightedFieldKey,
  filterMode,
  onFilterModeChange,
  sourceFilter,
  onSourceFilterChange,
  collapsedSections,
  onToggleSection,
  onExpandSection,
  onExpandAll,
  onCollapseAll,
  density,
  onDensityChange,
  columns,
  onColumnsChange,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showTechKeys, setShowTechKeys] = useState<boolean>(false);
  const [activeSectionJump, setActiveSectionJump] = useState<string>('');

  const liveFields = useMemo(
    () =>
      fields.map((f) => ({
        ...f,
        value: Object.prototype.hasOwnProperty.call(fieldValues, f.key)
          ? fieldValues[f.key]
          : f.value,
      })),
    [fields, fieldValues]
  );

  const allSectionsSummary = useMemo(() => groupFieldsBySection(liveFields), [liveFields]);

  const counts = useMemo(() => {
    let mandatoryEmpty = 0;
    let empty = 0;
    let attention = 0;
    let filled = 0;
    let icmCount = 0;
    let customDbCount = 0;
    for (const f of liveFields) {
      const isEmpty = isFieldEmpty(f.value);
      if (isEmpty) empty += 1;
      else filled += 1;
      if (f.required && isEmpty) mandatoryEmpty += 1;
      if (f.attention && f.attention !== 'none') attention += 1;
      if (f.source === 'ICM') icmCount += 1;
      else customDbCount += 1;
    }
    return { total: liveFields.length, mandatoryEmpty, empty, attention, filled, icmCount, customDbCount };
  }, [liveFields]);

  const filteredFields = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return liveFields.filter((f) => {
      const empty = isFieldEmpty(f.value);
      if (filterMode === 'mandatory-empty' && !(f.required && empty)) return false;
      if (filterMode === 'empty' && !empty) return false;
      if (filterMode === 'attention' && !(f.attention && f.attention !== 'none')) return false;
      if (filterMode === 'filled' && empty) return false;

      if (sourceFilter !== 'all' && f.source !== sourceFilter) return false;

      if (!q) return true;
      return [
        f.label,
        f.value,
        f.swiftTag || '',
        f.icmSymbolicName || '',
        f.customDbColumn || '',
        f.section,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [liveFields, filterMode, sourceFilter, searchTerm]);

  const sections = useMemo(() => groupFieldsBySection(filteredFields), [filteredFields]);

  const handleJumpToSection = (sectionName: string) => {
    setActiveSectionJump(sectionName);
    if (filterMode !== 'all') onFilterModeChange('all');
    if (sourceFilter !== 'all') onSourceFilterChange('all');
    onExpandSection(sectionName);
    requestAnimationFrame(() => {
      const el = document.getElementById(toSectionId(sectionName));
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const gridColsClass =
    columns === '1'
      ? 'grid-cols-1'
      : columns === '2'
      ? 'grid-cols-1 md:grid-cols-2'
      : columns === '3'
      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      : 'grid-cols-1 lg:grid-cols-2';

  const rowPad = density === 'compact' ? 'px-2 py-1' : 'px-2.5 py-1.5';
  const inputHeight = density === 'compact' ? 'h-6 text-[11.5px]' : 'h-7 text-xs';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#191116] border border-[#EBDCE3] dark:border-[#32222B] rounded-2xl overflow-hidden shadow-[0_6px_22px_-14px_rgba(151,20,77,0.16)]">
      {/* Compact Precision Filter & Layout Toolbar */}
      <div className="px-2.5 py-2 border-b border-[#EBDCE3] dark:border-[#32222B] bg-[#FBF2F6] dark:bg-[#22151D] space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-[#9B8591] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="field-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find field, SWIFT tag (:32B:), ICM, or DB col (/)"
              className="w-full pl-7 pr-2.5 py-1 text-xs rounded-md border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#120D11] text-[#1D161A] dark:text-[#F5EDF1] placeholder:text-[#9B8591] focus:outline-none focus:border-[#97144D]"
            />
          </div>

          {/* Segmented Source Filter */}
          <div className="flex items-center p-0.5 rounded-md bg-[#EFE0E8] dark:bg-[#2B1B24] text-[11px]">
            <button
              type="button"
              onClick={() => onSourceFilterChange('all')}
              className={`px-2 py-0.5 rounded font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                sourceFilter === 'all'
                  ? 'bg-white dark:bg-[#191116] text-[#97144D] dark:text-[#F48FB1] font-semibold shadow-xs'
                  : 'text-[#6E5D66] dark:text-[#BDAAB3] hover:text-[#1D161A] dark:hover:text-[#F5EDF1]'
              }`}
            >
              All ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => onSourceFilterChange('ICM')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                sourceFilter === 'ICM'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300'
              }`}
            >
              <Layers className="w-3 h-3 text-blue-700 dark:text-blue-400" />
              <span>ICM Case ({counts.icmCount})</span>
            </button>
            <button
              type="button"
              onClick={() => onSourceFilterChange('CUSTOM_DB')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                sourceFilter === 'CUSTOM_DB'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300'
              }`}
            >
              <Database className="w-3 h-3 text-teal-700 dark:text-teal-400" />
              <span>Custom DB ({counts.customDbCount})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowTechKeys((v) => !v)}
            title="Show or hide IBM ICM symbolic names and SQL DB column keys"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              showTechKeys
                ? 'border-[#97144D] bg-[#FDF1F6] dark:bg-[#2F1622] text-[#97144D] dark:text-[#F48FB1]'
                : 'border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-[#5E4E56] dark:text-[#CBBCC4] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922]'
            }`}
          >
            <Code2 className="w-3 h-3" />
            <span>Keys</span>
          </button>

          <select
            aria-label="Columns per row"
            value={columns}
            onChange={(e) => onColumnsChange(e.target.value as ColumnLayoutMode)}
            className="px-2 py-1 text-[11px] rounded-md border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-[#1D161A] dark:text-[#F5EDF1] focus:outline-none focus:border-[#97144D]"
          >
            <option value="auto">Auto (2 Col)</option>
            <option value="1">1 Col</option>
            <option value="2">2 Cols</option>
            <option value="3">3 Cols</option>
          </select>

          <div className="flex items-center p-0.5 rounded-md bg-[#EFE0E8] dark:bg-[#2B1B24] text-[11px]">
            <button
              type="button"
              onClick={() => onDensityChange('compact')}
              className={`px-2 py-0.5 font-medium rounded cursor-pointer ${
                density === 'compact'
                  ? 'bg-white dark:bg-[#191116] text-[#97144D] dark:text-[#F48FB1] shadow-xs'
                  : 'text-[#6E5D66] dark:text-[#BDAAB3]'
              }`}
            >
              Dense
            </button>
            <button
              type="button"
              onClick={() => onDensityChange('comfortable')}
              className={`px-2 py-0.5 font-medium rounded cursor-pointer ${
                density === 'comfortable'
                  ? 'bg-white dark:bg-[#191116] text-[#97144D] dark:text-[#F48FB1] shadow-xs'
                  : 'text-[#6E5D66] dark:text-[#BDAAB3]'
              }`}
            >
              Relaxed
            </button>
          </div>
        </div>

        {/* Readiness Filter Row + Section Expand/Collapse */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'all', label: `All (${counts.total})` },
                {
                  id: 'mandatory-empty',
                  label: `Mandatory Empty (${counts.mandatoryEmpty})`,
                  warn: counts.mandatoryEmpty > 0,
                },
                { id: 'empty', label: `Empty (${counts.empty})` },
                { id: 'attention', label: `Attention (${counts.attention})` },
                { id: 'filled', label: `Filled (${counts.filled})` },
              ] as { id: FieldFilterMode; label: string; warn?: boolean }[]
            ).map((tab) => {
              const active = filterMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onFilterModeChange(tab.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#97144D] text-white border-[#97144D]'
                      : tab.warn
                      ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 hover:bg-red-100/70'
                      : 'bg-white dark:bg-[#191116] border-[#E7D8DF] dark:border-[#3A2732] text-[#5E4E56] dark:text-[#CBBCC4] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={onExpandAll}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:underline cursor-pointer"
            >
              Expand all
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={onCollapseAll}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:underline cursor-pointer"
            >
              Collapse all
            </button>
            <span className="text-slate-400 dark:text-slate-600 font-mono tabular-nums">
              {filteredFields.length}/{counts.total}
            </span>
          </div>
        </div>
      </div>

      {/* Main Split: Slim Section Jump Rail + High-Speed Inline Key-Value Grid */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Slim Section Navigator */}
        <nav
          aria-label="LC form sections"
          className="hidden md:flex flex-col w-36 shrink-0 border-r border-[#EBDCE3] dark:border-[#32222B] bg-[#FBF6F9] dark:bg-[#150E13] p-1.5 overflow-y-auto space-y-0.5"
        >
          <div className="px-1.5 py-0.5 text-[10px] font-semibold text-[#8C7A83] dark:text-[#9D8792]">
            Sections
          </div>
          {allSectionsSummary.map((sec) => {
            const isSelected = activeSectionJump === sec.section;
            return (
              <button
                key={sec.section}
                type="button"
                onClick={() => handleJumpToSection(sec.section)}
                className={`w-full text-left px-1.5 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#FDF1F6] dark:bg-[#2F1622] text-[#97144D] dark:text-[#F48FB1] font-semibold'
                    : 'text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#F5E8EF] dark:hover:bg-[#24161E]'
                }`}
              >
                <div className="truncate font-medium leading-tight">{sec.section}</div>
                <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-[#7C6B74] dark:text-[#A996A0]">
                  <span>
                    {sec.filled}/{sec.total}
                  </span>
                  {sec.mandatoryEmpty > 0 ? (
                    <span className="text-red-600 dark:text-red-400 font-semibold">
                      {sec.mandatoryEmpty} err
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Scrollable Zero-Waste Field Ledger */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {sections.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#6E5D66] dark:text-[#BDAAB3]">
              <p className="font-medium text-[#1D161A] dark:text-[#F5EDF1] mb-1">
                No fields match the active filter
              </p>
              <button
                type="button"
                onClick={() => {
                  onFilterModeChange('all');
                  onSourceFilterChange('all');
                  setSearchTerm('');
                }}
                className="text-[#97144D] dark:text-[#F48FB1] font-medium underline cursor-pointer"
              >
                Show all {counts.total} fields
              </button>
            </div>
          ) : (
            sections.map((section) => {
              const isCollapsed = collapsedSections.has(section.section);
              return (
                <section
                  id={toSectionId(section.section)}
                  key={section.section}
                  className="border border-[#EBDCE3] dark:border-[#32222B] rounded-xl overflow-hidden"
                >
                  {/* Tight Section Header */}
                  <button
                    type="button"
                    onClick={() => onToggleSection(section.section)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 bg-[#FBF2F6] dark:bg-[#22151D] hover:bg-[#F5E6ED] dark:hover:bg-[#2A1922] transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {section.section}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 text-[11px] shrink-0 font-mono tabular-nums">
                      {section.mandatoryEmpty > 0 && (
                        <span className="inline-flex items-center gap-1 font-sans font-semibold text-red-700 dark:text-red-400">
                          <AlertCircle className="w-3 h-3" />
                          {section.mandatoryEmpty} mandatory empty
                        </span>
                      )}
                      {section.attentionCount > 0 && section.mandatoryEmpty === 0 && (
                        <span className="inline-flex items-center gap-1 font-sans font-semibold text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          {section.attentionCount} attention
                        </span>
                      )}
                      {section.mandatoryEmpty === 0 && section.attentionCount === 0 && (
                        <span className="inline-flex items-center gap-1 font-sans font-medium text-emerald-700 dark:text-emerald-400">
                          <Check className="w-3 h-3" />
                          Complete
                        </span>
                      )}
                      <span className="text-slate-500 dark:text-slate-400">
                        {section.filled}/{section.total}
                      </span>
                    </div>
                  </button>

                  {/* Hairline-Separated Horizontal Key : Value Cells */}
                  {!isCollapsed && (
                    <div
                      className={`grid ${gridColsClass} gap-px bg-[#EFE3E9] dark:bg-[#32222B] border-t border-[#EBDCE3] dark:border-[#32222B]`}
                    >
                      {section.fields.map((field) => {
                        const empty = isFieldEmpty(field.value);
                        const isMissingMandatory = field.required && empty;
                        const isAttention = !isMissingMandatory && field.attention && field.attention !== 'none';
                        const isHighlighted = highlightedFieldKey === field.key;

                        const cellSurface = isMissingMandatory
                          ? 'bg-red-50/85 dark:bg-red-950/35'
                          : isAttention
                          ? 'bg-amber-50/70 dark:bg-amber-950/25'
                          : isHighlighted
                          ? 'bg-[#FDF1F6] dark:bg-[#2F1622]'
                          : 'bg-white dark:bg-[#191116] hover:bg-[#FDF7FA] dark:hover:bg-[#21151D]';

                        const sourceTag =
                          field.source === 'ICM' ? (
                            <span
                              title={`IBM Case Manager Property: ${field.icmSymbolicName}`}
                              className="inline-flex items-center gap-0.5 px-1 py-[1px] rounded border border-blue-200/80 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[9.5px] font-medium leading-none whitespace-nowrap shrink-0"
                            >
                              <Layers className="w-2.5 h-2.5" />
                              <span>ICM</span>
                            </span>
                          ) : (
                            <span
                              title={`Custom DB Column: ${field.customDbColumn}`}
                              className="inline-flex items-center gap-0.5 px-1 py-[1px] rounded border border-teal-200/80 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-[9.5px] font-medium leading-none whitespace-nowrap shrink-0"
                            >
                              <Database className="w-2.5 h-2.5" />
                              <span>DB</span>
                            </span>
                          );

                        // Full-width clauses (45A Goods, 46A Documents, 47A Conditions, Discrepancy Notes)
                        if (field.type === 'textarea') {
                          return (
                            <div
                              key={field.id}
                              id={`field-row-${field.key}`}
                              className={`${cellSurface} ${rowPad} col-span-full flex flex-col gap-1 transition-colors`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <label
                                  htmlFor={`input-${field.key}`}
                                  className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 min-w-0"
                                >
                                  <span className="truncate">{field.label}</span>
                                  {field.required && (
                                    <span className="text-red-600 dark:text-red-400 font-bold">*</span>
                                  )}
                                  {sourceTag}
                                  {showTechKeys && (
                                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                                      ({field.source === 'ICM' ? field.icmSymbolicName : field.customDbColumn})
                                    </span>
                                  )}
                                </label>
                                {isMissingMandatory && (
                                  <span className="text-[10px] font-semibold text-red-700 dark:text-red-400 shrink-0">
                                    Empty
                                  </span>
                                )}
                              </div>
                              <textarea
                                id={`input-${field.key}`}
                                rows={density === 'compact' ? 2 : 3}
                                value={field.value}
                                readOnly={field.readOnly}
                                placeholder={field.placeholder || 'Enter clause text...'}
                                onFocus={() => onFocusField?.(field)}
                                onChange={(e) => onChangeField(field.key, e.target.value)}
                                className={`w-full px-2 py-1 text-[11.5px] leading-snug rounded border bg-[#FAF6F8] dark:bg-[#120D11] text-[#1D161A] dark:text-[#F5EDF1] focus:bg-white dark:focus:bg-[#120D11] focus:outline-none ${
                                  isMissingMandatory
                                    ? 'border-red-400 dark:border-red-700 focus:border-red-600'
                                    : isAttention
                                    ? 'border-amber-400 dark:border-amber-700 focus:border-amber-600'
                                    : 'border-[#E7D8DF] dark:border-[#3A2732] focus:border-[#97144D]'
                                } ${field.readOnly ? 'opacity-75 cursor-not-allowed' : ''}`}
                              />
                              {field.attentionReason && (isMissingMandatory || isAttention) && (
                                <p
                                  className={`text-[10.5px] leading-tight ${
                                    isMissingMandatory
                                      ? 'text-red-700 dark:text-red-400'
                                      : 'text-amber-700 dark:text-amber-400'
                                  }`}
                                >
                                  {field.attentionReason}
                                </p>
                              )}
                            </div>
                          );
                        }

                        // Single-Line High-Density Horizontal Ledger Row: Label [ICM/DB] : Input
                        return (
                          <div
                            key={field.id}
                            id={`field-row-${field.key}`}
                            className={`${cellSurface} ${rowPad} ${
                              field.fullWidth ? 'col-span-full' : ''
                            } flex flex-col justify-center gap-0.5 transition-colors`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {/* Left Label + Inline Source Indicator */}
                              <div className="w-[46%] shrink-0 flex items-center justify-between gap-1 min-w-0">
                                <label
                                  htmlFor={`input-${field.key}`}
                                  title={field.label}
                                  className="text-[11px] font-medium text-[#5E4E56] dark:text-[#DECED6] truncate"
                                >
                                  {field.label}
                                  {field.required && (
                                    <span className="text-red-600 dark:text-red-400 font-bold ml-0.5">*</span>
                                  )}
                                </label>
                                {sourceTag}
                              </div>

                              {/* Right Compact Editable Value */}
                              <div className="flex-1 min-w-0 flex items-center gap-1">
                                {field.type === 'select' ? (
                                  <select
                                    id={`input-${field.key}`}
                                    value={field.value}
                                    disabled={field.readOnly}
                                    onFocus={() => onFocusField?.(field)}
                                    onChange={(e) => onChangeField(field.key, e.target.value)}
                                    className={`w-full ${inputHeight} px-1.5 font-medium rounded border bg-transparent hover:bg-white dark:hover:bg-[#120D11] focus:bg-white dark:focus:bg-[#120D11] text-[#1D161A] dark:text-[#F5EDF1] focus:outline-none ${
                                      isMissingMandatory
                                        ? 'border-red-400 dark:border-red-700 bg-white/80 dark:bg-[#120D11]/80 focus:border-red-600'
                                        : isAttention
                                        ? 'border-amber-400 dark:border-amber-700 focus:border-amber-600'
                                        : 'border-transparent hover:border-[#DFCED6] dark:hover:border-[#3A2732] focus:border-[#97144D]'
                                    }`}
                                  >
                                    <option value="">Select...</option>
                                    {(field.options || []).map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    id={`input-${field.key}`}
                                    type={
                                      field.type === 'date'
                                        ? 'date'
                                        : field.type === 'number'
                                        ? 'number'
                                        : 'text'
                                    }
                                    value={field.value}
                                    readOnly={field.readOnly}
                                    placeholder={
                                      field.placeholder || (field.required ? 'Missing *' : '—')
                                    }
                                    onFocus={() => onFocusField?.(field)}
                                    onChange={(e) => onChangeField(field.key, e.target.value)}
                                    className={`w-full ${inputHeight} px-1.5 rounded border bg-transparent hover:bg-white dark:hover:bg-[#120D11] focus:bg-white dark:focus:bg-[#120D11] text-[#1D161A] dark:text-[#F5EDF1] focus:outline-none ${
                                      field.type === 'currency' ||
                                      field.type === 'number' ||
                                      field.type === 'date'
                                        ? 'font-mono tabular-nums'
                                        : 'font-medium'
                                    } ${
                                      isMissingMandatory
                                        ? 'border-red-400 dark:border-red-700 bg-white/80 dark:bg-[#120D11]/80 focus:border-red-600 placeholder:text-red-500 placeholder:font-semibold'
                                        : isAttention
                                        ? 'border-amber-400 dark:border-amber-700 focus:border-amber-600'
                                        : 'border-transparent hover:border-[#DFCED6] dark:hover:border-[#3A2732] focus:border-[#97144D]'
                                    } ${field.readOnly ? 'opacity-80 cursor-not-allowed' : ''}`}
                                  />
                                )}
                              </div>
                            </div>

                            {showTechKeys && (
                              <div className="text-[9.5px] font-mono text-slate-400 dark:text-slate-500 pl-0.5 truncate">
                                {field.source === 'ICM'
                                  ? `ICM: ${field.icmSymbolicName}`
                                  : `SQL: ${field.customDbColumn}`}
                              </div>
                            )}

                            {field.attentionReason && (isMissingMandatory || isAttention) && (
                              <div
                                className={`text-[10px] leading-tight pl-0.5 truncate ${
                                  isMissingMandatory
                                    ? 'text-red-700 dark:text-red-400 font-medium'
                                    : 'text-amber-700 dark:text-amber-400'
                                }`}
                                title={field.attentionReason}
                              >
                                {field.attentionReason}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
