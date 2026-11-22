import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Clock,
  Columns3,
  Download,
  FileCheck2,
  FolderOpen,
  Inbox,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import type { IcmInBasket, IcmWorkItem } from '../types/icm';
import { computeFieldMetrics } from '../utils/fieldMetrics';
import { cn } from '../utils/cn';

interface InboxViewProps {
  inBaskets: IcmInBasket[];
  workItems: IcmWorkItem[];
  activeBasketId: string;
  currentActorName: string;
  onSelectBasket: (id: string) => void;
  onOpenWorkItem: (wobNum: string) => void;
  onOpenCase360: (caseId: string) => void;
  onReassignBatch: (wobNums: string[], targetUser: string) => Promise<void>;
  onOpenAddCase: () => void;
  recentlyCreatedCase?: IcmWorkItem | null;
  onDismissCreatedBanner?: () => void;
}

type ColumnKey =
  | 'lcReference'
  | 'processType'
  | 'stepName'
  | 'counterparties'
  | 'amount'
  | 'readiness'
  | 'documents'
  | 'ageing'
  | 'sla'
  | 'priority'
  | 'assignedTo'
  | 'caseId';

interface ColumnMeta {
  key: ColumnKey;
  label: string;
  align?: 'left' | 'right';
  locked?: boolean;
}

const ALL_COLUMNS: ColumnMeta[] = [
  { key: 'lcReference', label: 'Transaction & Goods', locked: true },
  { key: 'processType', label: 'Process & Branch' },
  { key: 'stepName', label: 'Workflow Step' },
  { key: 'counterparties', label: 'Applicant / Beneficiary' },
  { key: 'amount', label: 'LC Amount', align: 'right' },
  { key: 'readiness', label: 'Field Readiness' },
  { key: 'documents', label: 'Doc Pack' },
  { key: 'ageing', label: 'Ageing' },
  { key: 'sla', label: 'SLA Clock' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignedTo', label: 'Owner' },
  { key: 'caseId', label: 'Case ID' },
];

const DEFAULT_VISIBLE: ColumnKey[] = [
  'lcReference',
  'processType',
  'stepName',
  'counterparties',
  'amount',
  'readiness',
  'documents',
  'ageing',
  'sla',
  'priority',
  'assignedTo',
];

type AgeingBucket = 'all' | '0-2' | '3-6' | '7+';
type QuickTriage = 'none' | 'mandatory-gap' | 'sla-critical' | 'sanctions-hold';

function formatCompactExposure(items: IcmWorkItem[]): string {
  const total = items.reduce((acc, item) => acc + item.amount, 0);
  if (total >= 1_000_000) {
    return `$${(total / 1_000_000).toFixed(2)}M`;
  }
  if (total >= 1_000) {
    return `$${Math.round(total / 1_000)}K`;
  }
  return `$${total.toLocaleString()}`;
}

export const InboxView: React.FC<InboxViewProps> = ({
  inBaskets,
  workItems,
  activeBasketId,
  currentActorName,
  onSelectBasket,
  onOpenWorkItem,
  onOpenCase360,
  onReassignBatch,
  onOpenAddCase,
  recentlyCreatedCase,
  onDismissCreatedBanner,
}) => {
  const [railOpen, setRailOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pinnedSearch, setPinnedSearch] = useState<string>('');
  const [priorityFilterOnly, setPriorityFilterOnly] = useState<boolean>(false);
  const [mandatoryGapFilterOnly, setMandatoryGapFilterOnly] = useState<boolean>(false);
  const [quickTriage, setQuickTriage] = useState<QuickTriage>('none');
  const [ageingBucket, setAgeingBucket] = useState<AgeingBucket>('all');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('compact');
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(ALL_COLUMNS.map((c) => c.key));
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(new Set(DEFAULT_VISIBLE));
  const [showColumnMenu, setShowColumnMenu] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<ColumnKey>('ageing');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [selectedWobs, setSelectedWobs] = useState<Set<string>>(new Set());
  const [reassignTarget, setReassignTarget] = useState<string>('Ahmad Jamal');
  const [batchBusy, setBatchBusy] = useState<boolean>(false);

  const metricsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeFieldMetrics>>();
    for (const item of workItems) {
      map.set(item.wobNum, computeFieldMetrics(item.fields));
    }
    return map;
  }, [workItems]);

  const myQueueCount = useMemo(
    () => workItems.filter((w) => w.assignedTo.toLowerCase() === currentActorName.toLowerCase()).length,
    [workItems, currentActorName]
  );

  const basketItems = useMemo(() => {
    if (activeBasketId === 'my-queue') {
      return workItems.filter((w) => w.assignedTo.toLowerCase() === currentActorName.toLowerCase());
    }
    if (activeBasketId === 'all') return workItems;
    return workItems.filter((item) => item.inBasketId === activeBasketId);
  }, [workItems, activeBasketId, currentActorName]);

  const globalTriageCounts = useMemo(() => {
    let mandatoryGap = 0;
    let slaCritical = 0;
    let sanctionsHold = 0;
    for (const item of workItems) {
      if ((metricsMap.get(item.wobNum)?.mandatoryEmpty || 0) > 0) mandatoryGap += 1;
      if (item.slaRemainingMinutes <= 240 || item.priority === 'High') slaCritical += 1;
      if (item.sanctionsStatus !== 'Cleared') sanctionsHold += 1;
    }
    return { mandatoryGap, slaCritical, sanctionsHold };
  }, [workItems, metricsMap]);

  const kpis = useMemo(() => {
    const sortedByAge = [...basketItems].sort((a, b) => b.ageingDays - a.ageingDays);
    const oldest = sortedByAge[0] || null;
    const highPriorityCount = basketItems.filter((i) => i.priority === 'High' || i.slaRemainingMinutes <= 240).length;
    const mandatoryGapCount = basketItems.filter((i) => (metricsMap.get(i.wobNum)?.mandatoryEmpty || 0) > 0).length;
    const totalFields = basketItems.reduce((sum, i) => sum + (metricsMap.get(i.wobNum)?.total || 0), 0);
    const filledFields = basketItems.reduce((sum, i) => sum + (metricsMap.get(i.wobNum)?.filled || 0), 0);
    const avgCompletionPct = totalFields === 0 ? 100 : Math.round((filledFields / totalFields) * 100);
    const bucket02 = basketItems.filter((i) => i.ageingDays < 3).length;
    const bucket36 = basketItems.filter((i) => i.ageingDays >= 3 && i.ageingDays < 7).length;
    const bucket7p = basketItems.filter((i) => i.ageingDays >= 7).length;

    return {
      oldest,
      highPriorityCount,
      mandatoryGapCount,
      avgCompletionPct,
      exposure: formatCompactExposure(basketItems),
      bucket02,
      bucket36,
      bucket7p,
    };
  }, [basketItems, metricsMap]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return basketItems
      .filter((item) => {
        if (priorityFilterOnly && item.priority !== 'High' && item.slaRemainingMinutes > 240) return false;
        const m = metricsMap.get(item.wobNum);
        if (mandatoryGapFilterOnly && (!m || m.mandatoryEmpty === 0)) return false;

        if (quickTriage === 'mandatory-gap' && (!m || m.mandatoryEmpty === 0)) return false;
        if (quickTriage === 'sla-critical' && item.slaRemainingMinutes > 240 && item.priority !== 'High') return false;
        if (quickTriage === 'sanctions-hold' && item.sanctionsStatus === 'Cleared') return false;

        if (ageingBucket === '0-2' && item.ageingDays >= 3) return false;
        if (ageingBucket === '3-6' && (item.ageingDays < 3 || item.ageingDays >= 7)) return false;
        if (ageingBucket === '7+' && item.ageingDays < 7) return false;

        if (!q) return true;
        return [
          item.wid || '',
          item.lcReference,
          item.caseId,
          item.wobNum,
          item.subject,
          item.applicantName,
          item.beneficiaryName,
          item.stepName,
          item.assignedTo,
          item.processType,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const dir = sortAsc ? 1 : -1;
        switch (sortKey) {
          case 'amount':
            return (a.amount - b.amount) * dir;
          case 'ageing':
            return (a.ageingDays - b.ageingDays) * dir;
          case 'sla':
            return (a.slaRemainingMinutes - b.slaRemainingMinutes) * dir;
          case 'readiness': {
            const ma = metricsMap.get(a.wobNum)?.mandatoryEmpty ?? 0;
            const mb = metricsMap.get(b.wobNum)?.mandatoryEmpty ?? 0;
            return (ma - mb) * dir;
          }
          case 'counterparties':
            return a.applicantName.localeCompare(b.applicantName) * dir;
          case 'documents': {
            const da = a.documents.filter((d) => d.verificationStatus === 'Discrepancy').length;
            const db = b.documents.filter((d) => d.verificationStatus === 'Discrepancy').length;
            return (da - db) * dir;
          }
          case 'priority': {
            const rank = { High: 3, Medium: 2, Low: 1 };
            return (rank[a.priority] - rank[b.priority]) * dir;
          }
          default: {
            const va = String(a[sortKey as keyof IcmWorkItem] || '');
            const vb = String(b[sortKey as keyof IcmWorkItem] || '');
            return va.localeCompare(vb) * dir;
          }
        }
      });
  }, [
    basketItems,
    searchQuery,
    priorityFilterOnly,
    mandatoryGapFilterOnly,
    quickTriage,
    ageingBucket,
    sortKey,
    sortAsc,
    metricsMap,
  ]);

  const activeColumns = useMemo(
    () =>
      columnOrder
        .filter((k) => visibleCols.has(k))
        .map((k) => ALL_COLUMNS.find((c) => c.key === k)!)
        .filter(Boolean),
    [columnOrder, visibleCols]
  );

  const toggleSort = (key: ColumnKey) => {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    if (key === 'lcReference') return;
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const moveColumn = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 1 || target >= columnOrder.length) return;
    setColumnOrder((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  const handleToggleAllRows = () => {
    if (selectedWobs.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedWobs(new Set());
    } else {
      setSelectedWobs(new Set(filteredItems.map((i) => i.wobNum)));
    }
  };

  const buildExportRows = () =>
    filteredItems.map((i) => {
      const m = computeFieldMetrics(i.fields);
      return {
        WOB: i.wobNum,
        'LC Reference': i.lcReference,
        'Case ID': i.caseId,
        Process: i.processType,
        Step: i.stepName,
        Applicant: i.applicantName,
        Beneficiary: i.beneficiaryName,
        Currency: i.currency,
        Amount: i.amount,
        'Mandatory Ready': `${m.mandatoryFilled}/${m.mandatoryTotal}`,
        'Mandatory Empty': m.mandatoryEmpty,
        Priority: i.priority,
        Ageing: i.ageingLabel,
        'SLA Status': i.slaLabel,
        Owner: i.assignedTo,
      };
    });

  const handleExportCsv = () => {
    const records = buildExportRows();
    if (records.length === 0) return;
    const header = Object.keys(records[0]);
    const rows = records.map((r) =>
      header.map((h) => String((r as Record<string, unknown>)[h] ?? '')),
    );
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `icm_lc_inbox_${activeBasketId}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const records = buildExportRows();
    if (records.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(records);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'LC_Inbox');
    XLSX.writeFile(
      workbook,
      `icm_lc_inbox_${activeBasketId}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`,
    );
  };

  const handleBatchReassign = async () => {
    if (selectedWobs.size === 0) return;
    setBatchBusy(true);
    try {
      await onReassignBatch(Array.from(selectedWobs), reassignTarget);
      setSelectedWobs(new Set());
    } finally {
      setBatchBusy(false);
    }
  };

  const resetAllFilters = () => {
    setPriorityFilterOnly(false);
    setMandatoryGapFilterOnly(false);
    setQuickTriage('none');
    setAgeingBucket('all');
    setSearchQuery('');
    setVisibleCols(new Set(DEFAULT_VISIBLE));
    setColumnOrder(ALL_COLUMNS.map((c) => c.key));
  };

  const activeBasket = inBaskets.find((b) => b.id === activeBasketId);
  const totalAgeingBase = Math.max(1, basketItems.length);

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] bg-gradient-to-b from-[#FDF1F6]/80 via-[#FAF6F8] to-[#FAF6F8] dark:from-[#1B1016] dark:via-[#120D11] dark:to-[#120D11]">
      {/* Left Enterprise In-Basket Navigation Rail */}
      <aside
        className={`${
          railOpen ? 'w-64' : 'w-14'
        } hidden lg:flex flex-col shrink-0 border-r border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] transition-all duration-150`}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-[#EBDCE3] dark:border-[#32222B]">
          {railOpen && (
            <span className="text-xs font-semibold text-[#1D161A] dark:text-[#F5EDF1] truncate">
              ICM Work Queues
            </span>
          )}
          <button
            type="button"
            onClick={() => setRailOpen((o) => !o)}
            title={railOpen ? 'Collapse queue rail' : 'Expand queue rail'}
            aria-label={railOpen ? 'Collapse queue rail' : 'Expand queue rail'}
            className="p-1.5 rounded-md text-[#6B5A63] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] hover:text-[#97144D] dark:hover:text-[#F48FB1] cursor-pointer"
          >
            {railOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-5">
          {/* Primary Queues */}
          <div className="space-y-1">
            {railOpen && (
              <div className="px-2 py-1 text-[11px] font-semibold text-[#8A7580] dark:text-[#9A8590]">
                Operator Queues
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                onSelectBasket('my-queue');
                setQuickTriage('none');
              }}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeBasketId === 'my-queue'
                  ? 'bg-[#FDF1F6] dark:bg-[#3A1426] text-[#97144D] dark:text-[#F48FB1] font-semibold'
                  : 'text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF5F9] dark:hover:bg-[#271820]'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <UserCheck className="w-4 h-4 shrink-0" />
                {railOpen && <span className="truncate">My Queue ({currentActorName.split(' ')[0]})</span>}
              </span>
              {railOpen && (
                <span className="font-mono tabular-nums text-[11px]">{myQueueCount}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectBasket('all');
                setQuickTriage('none');
              }}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeBasketId === 'all' && quickTriage === 'none'
                  ? 'bg-[#FDF1F6] dark:bg-[#3A1426] text-[#97144D] dark:text-[#F48FB1] font-semibold'
                  : 'text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF5F9] dark:hover:bg-[#271820]'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Inbox className="w-4 h-4 shrink-0" />
                {railOpen && <span className="truncate">All In-Baskets</span>}
              </span>
              {railOpen && (
                <span className="font-mono tabular-nums text-[11px]">{workItems.length}</span>
              )}
            </button>
          </div>

          {/* Role In-Baskets */}
          <div className="space-y-1">
            {railOpen && (
              <div className="px-2 py-1 text-[11px] font-semibold text-[#8A7580] dark:text-[#9A8590]">
                Role In-Baskets
              </div>
            )}

            {inBaskets.map((basket) => {
              const items = workItems.filter((w) => w.inBasketId === basket.id);
              const urgentCount = items.filter((w) => w.priority === 'High' || w.slaRemainingMinutes <= 240).length;
              const active = activeBasketId === basket.id;

              return (
                <button
                  key={basket.id}
                  type="button"
                  onClick={() => {
                    onSelectBasket(basket.id);
                    setQuickTriage('none');
                  }}
                  title={`${basket.name} (${basket.roleName})`}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#FDF1F6] dark:bg-[#3A1426] text-[#97144D] dark:text-[#F48FB1] font-semibold'
                      : 'text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF5F9] dark:hover:bg-[#271820]'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Layers className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    {railOpen && (
                      <span className="min-w-0">
                        <span className="block truncate">{basket.name}</span>
                        <span className="block text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                          {basket.roleName}
                        </span>
                      </span>
                    )}
                  </span>
                  {railOpen && (
                    <span className="flex items-center gap-1.5 font-mono tabular-nums text-[11px] shrink-0">
                      {urgentCount > 0 && (
                        <span className="text-red-600 dark:text-red-400 font-semibold" title="High priority / SLA risk">
                          {urgentCount}!
                        </span>
                      )}
                      <span>{items.length}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Exception Triage */}
          {railOpen && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                Exception Triage
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectBasket('all');
                  setQuickTriage((t) => (t === 'mandatory-gap' ? 'none' : 'mandatory-gap'));
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                  quickTriage === 'mandatory-gap'
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="truncate">Missing Mandatory</span>
                </span>
                <span className="font-mono tabular-nums text-[11px]">{globalTriageCounts.mandatoryGap}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectBasket('all');
                  setQuickTriage((t) => (t === 'sla-critical' ? 'none' : 'sla-critical'));
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                  quickTriage === 'sla-critical'
                    ? 'bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Clock className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                  <span className="truncate">SLA Risk / High</span>
                </span>
                <span className="font-mono tabular-nums text-[11px]">{globalTriageCounts.slaCritical}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectBasket('all');
                  setQuickTriage((t) => (t === 'sanctions-hold' ? 'none' : 'sanctions-hold'));
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                  quickTriage === 'sanctions-hold'
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="truncate">Sanctions Review</span>
                </span>
                <span className="font-mono tabular-nums text-[11px]">{globalTriageCounts.sanctionsHold}</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Queue Workspace Canvas */}
      <div className="flex-1 min-w-0 px-4 sm:px-6 py-4 space-y-4">
        {/* Queue Title + Search & Command Toolbar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Trade Finance Operations</span>
              <span aria-hidden="true">/</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {activeBasketId === 'my-queue'
                  ? `Owner: ${currentActorName}`
                  : activeBasket
                  ? `Role: ${activeBasket.roleName}`
                  : 'All ICM Baskets'}
              </span>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">
              {activeBasketId === 'my-queue'
                ? `My Assigned Transactions — ${currentActorName}`
                : activeBasket
                ? activeBasket.name
                : 'Letter of Credit Transaction Inbox'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-80">
              <Search className="w-3.5 h-3.5 text-[#97144D] dark:text-[#F48FB1] opacity-75 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="inbox-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search LC ref, WID, case ID, applicant (/)"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#DFC9D3] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-[#1D161A] dark:text-[#F5EDF1] placeholder:text-[#9A8590] focus:outline-none focus:border-[#97144D]"
              />
            </div>

            <button
              type="button"
              onClick={() => setPinnedSearch(searchQuery)}
              disabled={!searchQuery.trim()}
              title="Pin current search query"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-xs font-medium text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Pin className="w-3.5 h-3.5" />
              <span>Pin</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColumnMenu((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-xs font-medium text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>
                  Columns ({activeColumns.length}/{ALL_COLUMNS.length})
                </span>
              </button>

              {showColumnMenu && (
                <div className="absolute right-0 top-9 z-40 w-80 p-3 rounded-xl border border-[#EBDCE3] dark:border-[#3A2732] bg-white dark:bg-[#191116] shadow-xl">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F2E6EC] dark:border-[#32222B]">
                    <span className="text-xs font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                      Show &amp; Reorder Columns
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowColumnMenu(false)}
                      className="text-xs text-[#97144D] dark:text-[#F48FB1] font-semibold cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {columnOrder.map((key, idx) => {
                      const meta = ALL_COLUMNS.find((c) => c.key === key)!;
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] text-xs"
                        >
                          <label className="flex items-center gap-2 flex-1 cursor-pointer text-[#3C3037] dark:text-[#DECED6]">
                            <input
                              type="checkbox"
                              checked={visibleCols.has(key)}
                              disabled={meta.locked}
                              onChange={() => toggleColumn(key)}
                              className="rounded border-[#D5BFC9] accent-[#97144D]"
                            />
                            <span>
                              {meta.label}
                              {meta.locked ? ' (locked)' : ''}
                            </span>
                          </label>
                          {!meta.locked && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveColumn(idx, -1)}
                                aria-label="Move column up"
                                className="p-0.5 rounded border border-[#E7D8DF] dark:border-[#3A2732] text-[#6B5A63] hover:text-[#97144D] cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveColumn(idx, 1)}
                                aria-label="Move column down"
                                className="p-0.5 rounded border border-[#E7D8DF] dark:border-[#3A2732] text-[#6B5A63] hover:text-[#97144D] cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center p-0.5 rounded-lg bg-[#F1E4EA] dark:bg-[#2A1922] text-xs">
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-2 py-1 rounded-md font-medium cursor-pointer ${
                  density === 'compact'
                    ? 'bg-white dark:bg-[#191116] text-[#97144D] dark:text-[#F48FB1] shadow-xs'
                    : 'text-[#5E4E56] dark:text-[#B9A7B0]'
                }`}
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setDensity('comfortable')}
                className={`px-2 py-1 rounded-md font-medium cursor-pointer ${
                  density === 'comfortable'
                    ? 'bg-white dark:bg-[#191116] text-[#97144D] dark:text-[#F48FB1] shadow-xs'
                    : 'text-[#5E4E56] dark:text-[#B9A7B0]'
                }`}
              >
                Spacious
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              title="Export filtered work queue to Excel (.xlsx)"
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 whitespace-nowrap shrink-0 cursor-pointer',
              )}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              title="Export filtered work queue to CSV"
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-xs font-medium text-[#4B3F46] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] whitespace-nowrap shrink-0 cursor-pointer',
              )}
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E7D8DF] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-xs font-medium text-[#5E4E56] dark:text-[#CBBCC4] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={onOpenAddCase}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#97144D] hover:bg-[#7A0E3D] text-white text-xs font-semibold whitespace-nowrap shrink-0 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Case</span>
            </button>
          </div>
        </div>

        {/* Recently Created Maker Case Confirmation Bar */}
        {recentlyCreatedCase && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold">
                Case created in IBM ICM at Maker Stage
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold">
                WID {recentlyCreatedCase.wid}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{recentlyCreatedCase.caseId}</span>
              <span aria-hidden="true">·</span>
              <span>
                {recentlyCreatedCase.documents.length} FileNet doc(s) attached
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenWorkItem(recentlyCreatedCase.wobNum)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Open Maker Work Page</span>
                <ArrowRight className="w-3 h-3" />
              </button>
              {onDismissCreatedBanner && (
                <button
                  type="button"
                  onClick={onDismissCreatedBanner}
                  aria-label="Dismiss notification"
                  className="p-1 rounded text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mobile/Tablet Horizontal In-Basket Tabs (visible below lg) */}
        <div className="flex lg:hidden items-center gap-1 border-b border-[#EBDCE3] dark:border-[#32222B] overflow-x-auto">
          <button
            type="button"
            onClick={() => onSelectBasket('my-queue')}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeBasketId === 'my-queue'
                ? 'border-[#97144D] text-[#97144D] dark:text-[#F48FB1] font-semibold'
                : 'border-transparent text-[#6E5D66] dark:text-[#BDAAB3]'
            }`}
          >
            My Queue ({myQueueCount})
          </button>
          <button
            type="button"
            onClick={() => onSelectBasket('all')}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeBasketId === 'all'
                ? 'border-[#97144D] text-[#97144D] dark:text-[#F48FB1] font-semibold'
                : 'border-transparent text-[#6E5D66] dark:text-[#BDAAB3]'
            }`}
          >
            All ({workItems.length})
          </button>
          {inBaskets.map((basket) => {
            const count = workItems.filter((w) => w.inBasketId === basket.id).length;
            return (
              <button
                key={basket.id}
                type="button"
                onClick={() => onSelectBasket(basket.id)}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                  activeBasketId === basket.id
                    ? 'border-[#97144D] text-[#97144D] dark:text-[#F48FB1] font-semibold'
                    : 'border-transparent text-[#6E5D66] dark:text-[#BDAAB3]'
                }`}
              >
                {basket.name} ({count})
              </button>
            );
          })}
        </div>

        {pinnedSearch && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#E7C6D4] dark:border-[#4A2535] bg-[#FDF1F6] dark:bg-[#2F1622] text-xs text-[#7A0E3D] dark:text-[#F48FB1]">
            <div className="flex items-center gap-2">
              <Pin className="w-3.5 h-3.5" />
              <span>
                Pinned Search: <strong>{pinnedSearch}</strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSearchQuery(pinnedSearch)}
                className="font-semibold underline cursor-pointer"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setPinnedSearch('')}
                className="text-[#6E5D66] dark:text-[#BDAAB3] hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* 4-Panel Operational Queue Command Strip (Signature Banking Card Contrast) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#7D0F3E] via-[#97144D] to-[#C2185B] text-white shadow-[0_10px_24px_-10px_rgba(151,20,77,0.45)]">
            <div className="flex items-center justify-between text-xs text-rose-100/90">
              <span>Queue Volume &amp; Exposure</span>
              <span className="font-mono">{kpis.oldest ? `Oldest ${kpis.oldest.ageingLabel}` : 'Clear'}</span>
            </div>
            <div className="flex items-baseline gap-2.5 mt-1.5">
              <span className="text-xl font-bold font-mono tabular-nums text-white">
                {basketItems.length} Cases
              </span>
              <span className="text-sm font-mono tabular-nums font-semibold text-rose-100">
                {kpis.exposure}
              </span>
            </div>
            <div className="text-[11px] text-rose-100/85 mt-1 truncate">
              {kpis.oldest ? `Longest pending: ${kpis.oldest.lcReference}` : 'No queued transactions'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMandatoryGapFilterOnly((v) => !v)}
            className={`p-3.5 rounded-2xl border text-left transition-colors cursor-pointer shadow-[0_2px_12px_-6px_rgba(151,20,77,0.08)] ${
              mandatoryGapFilterOnly
                ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30'
                : 'border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] hover:border-[#C2185B]/45'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-[#6B5A63] dark:text-[#B9A7B0]">
              <span>Mandatory Field Readiness</span>
              <span className="font-mono tabular-nums">{kpis.avgCompletionPct}% populated</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400">
                {kpis.mandatoryGapCount}
              </span>
              <span className="text-xs font-medium text-[#3C3037] dark:text-[#DECED6]">
                {kpis.mandatoryGapCount === 1 ? 'case has empty required fields' : 'cases have empty required fields'}
              </span>
            </div>
            <div className="text-[11px] text-[#6B5A63] dark:text-[#B9A7B0] mt-1">
              {mandatoryGapFilterOnly ? 'Filter active (click to show all)' : 'Click to isolate incomplete cases'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPriorityFilterOnly((v) => !v)}
            className={`p-3.5 rounded-2xl border text-left transition-colors cursor-pointer shadow-[0_2px_12px_-6px_rgba(151,20,77,0.08)] ${
              priorityFilterOnly
                ? 'border-[#97144D] bg-[#FDF1F6] dark:bg-[#3A1426]/40'
                : 'border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] hover:border-[#C2185B]/45'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-[#6B5A63] dark:text-[#B9A7B0]">
              <span>SLA Risk &amp; High Priority</span>
              <span className="font-mono">Target ≤ 4h</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-bold font-mono tabular-nums text-[#97144D] dark:text-[#F48FB1]">
                {kpis.highPriorityCount}
              </span>
              <span className="text-xs font-medium text-[#3C3037] dark:text-[#DECED6]">
                urgent transactions
              </span>
            </div>
            <div className="text-[11px] text-[#6B5A63] dark:text-[#B9A7B0] mt-1">
              {priorityFilterOnly ? 'Filter active (click to show all)' : 'Click to isolate urgent items'}
            </div>
          </button>

          <div className="p-3.5 rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] shadow-[0_2px_12px_-6px_rgba(151,20,77,0.08)]">
            <div className="flex items-center justify-between text-xs text-[#6B5A63] dark:text-[#B9A7B0]">
              <span>Ageing Distribution</span>
              {ageingBucket !== 'all' && (
                <button
                  type="button"
                  onClick={() => setAgeingBucket('all')}
                  className="text-[#97144D] dark:text-[#F48FB1] font-medium hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            {/* Proportional Stacked Ageing Bar */}
            <div className="flex h-2 w-full rounded bg-[#F5EAEF] dark:bg-[#2A1D24] overflow-hidden mt-2 mb-2.5">
              <div
                className="bg-emerald-600 dark:bg-emerald-500"
                style={{ width: `${(kpis.bucket02 / totalAgeingBase) * 100}%` }}
                title={`0-2 Days: ${kpis.bucket02}`}
              />
              <div
                className="bg-amber-500"
                style={{ width: `${(kpis.bucket36 / totalAgeingBase) * 100}%` }}
                title={`3-6 Days: ${kpis.bucket36}`}
              />
              <div
                className="bg-[#97144D] dark:bg-[#EC407A]"
                style={{ width: `${(kpis.bucket7p / totalAgeingBase) * 100}%` }}
                title={`7+ Days: ${kpis.bucket7p}`}
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              {(
                [
                  { id: '0-2', label: `0–2d (${kpis.bucket02})`, tone: 'text-emerald-700 dark:text-emerald-400' },
                  { id: '3-6', label: `3–6d (${kpis.bucket36})`, tone: 'text-amber-700 dark:text-amber-400' },
                  { id: '7+', label: `7+d (${kpis.bucket7p})`, tone: 'text-[#97144D] dark:text-[#F48FB1]' },
                ] as { id: AgeingBucket; label: string; tone: string }[]
              ).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setAgeingBucket((prev) => (prev === b.id ? 'all' : b.id))}
                  className={`px-2 py-0.5 rounded border font-mono tabular-nums cursor-pointer transition-colors ${
                    ageingBucket === b.id
                      ? 'bg-[#97144D] text-white border-[#97144D]'
                      : `border-[#EBDCE3] dark:border-[#32222B] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] ${b.tone}`
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Batch Reassignment Bar */}
        {selectedWobs.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-[#E3B8CA] dark:border-[#5C1A37] bg-[#FDF1F6] dark:bg-[#2E111E] text-xs">
            <span className="font-semibold text-[#7A0E3D] dark:text-[#F8BBD0]">
              {selectedWobs.size} transaction(s) selected for batch routing
            </span>
            <div className="flex items-center gap-2">
              <select
                value={reassignTarget}
                onChange={(e) => setReassignTarget(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#DECED6] dark:border-[#3A2732] bg-white dark:bg-[#191116] text-[#1D161A] dark:text-[#F5EDF1] text-xs"
              >
                <option value="Ahmad Jamal">Ahmad Jamal (Checker)</option>
                <option value="Priya Nair">Priya Nair (LC Maker)</option>
                <option value="Rohan Mehta">Rohan Mehta (Doc Examiner)</option>
                <option value="S. Kulkarni">S. Kulkarni (Compliance)</option>
              </select>
              <button
                type="button"
                disabled={batchBusy}
                onClick={handleBatchReassign}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#97144D] text-white font-semibold hover:bg-[#7A0E3D] disabled:opacity-50 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Reassign Selected</span>
              </button>
            </div>
          </div>
        )}

        {/* Enterprise High-Density Transaction Grid (Click any row to launch Work Page) */}
        <div className="rounded-2xl border border-[#EBDCE3] dark:border-[#32222B] bg-white dark:bg-[#191116] overflow-hidden shadow-[0_4px_20px_-8px_rgba(151,20,77,0.08)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#EBDCE3] dark:border-[#32222B] bg-[#FBF2F6] dark:bg-[#22151C] text-[11px] font-semibold text-[#5E4E56] dark:text-[#CBBCC4]">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all visible rows"
                      checked={filteredItems.length > 0 && selectedWobs.size === filteredItems.length}
                      onChange={handleToggleAllRows}
                      className="rounded border-[#D5BFC9] accent-[#97144D]"
                    />
                  </th>
                  {activeColumns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`px-3 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-100 ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>{col.label}</span>
                        {sortKey === col.key && <span className="text-[10px]">{sortAsc ? '▲' : '▼'}</span>}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeColumns.length + 2}
                      className="px-6 py-14 text-center text-slate-500 dark:text-slate-400"
                    >
                      <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        No Letter of Credit transactions match the active queue filters
                      </div>
                      <p className="text-xs mb-3">
                        Switch queues in the left rail or clear your search / triage filters.
                      </p>
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-medium hover:bg-blue-800 cursor-pointer"
                      >
                        Show All Queued Transactions
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const m = metricsMap.get(item.wobNum)!;
                    const docTotal = item.documents.length;
                    const docVerified = item.documents.filter((d) => d.verificationStatus === 'Verified').length;
                    const docDiscrepancy = item.documents.filter((d) => d.verificationStatus === 'Discrepancy').length;
                    const cellPad = density === 'compact' ? 'py-2.5' : 'py-3.5';
                    const ageBarColor =
                      item.ageingDays >= 7
                        ? 'bg-red-600 dark:bg-red-500'
                        : item.ageingDays >= 3
                        ? 'bg-amber-500'
                        : 'bg-emerald-600 dark:bg-emerald-500';

                    return (
                      <tr
                        key={item.wobNum}
                        onClick={() => onOpenWorkItem(item.wobNum)}
                        className="group hover:bg-[#FDF4F8] dark:hover:bg-[#2A1922] transition-colors cursor-pointer"
                      >
                        <td
                          className={`px-3 ${cellPad}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.lcReference}`}
                            checked={selectedWobs.has(item.wobNum)}
                            onChange={() => {
                              setSelectedWobs((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.wobNum)) next.delete(item.wobNum);
                                else next.add(item.wobNum);
                                return next;
                              });
                            }}
                            className="rounded border-[#D5BFC9] accent-[#97144D]"
                          />
                        </td>

                        {activeColumns.map((col) => {
                          switch (col.key) {
                            case 'lcReference':
                              return (
                                <td key={col.key} className={`px-3 ${cellPad} max-w-[320px]`}>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-mono font-semibold text-[#97144D] dark:text-[#F48FB1] group-hover:underline">
                                      {item.lcReference}
                                    </span>
                                    {item.wid && (
                                      <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                        · WID {item.wid}
                                      </span>
                                    )}
                                    <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                                      · {item.caseId}
                                    </span>
                                  </div>
                                  <div className="text-slate-700 dark:text-slate-300 truncate mt-0.5">
                                    {item.subject}
                                  </div>
                                </td>
                              );
                            case 'processType':
                              return (
                                <td key={col.key} className={`px-3 ${cellPad} whitespace-nowrap`}>
                                  <div className="font-medium text-slate-800 dark:text-slate-200">
                                    {item.processType}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {item.branchCode} · {item.incoterms}
                                  </div>
                                </td>
                              );
                            case 'stepName':
                              return (
                                <td key={col.key} className={`px-3 ${cellPad} whitespace-nowrap`}>
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {item.stepName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {item.caseMode} Mode
                                  </div>
                                </td>
                              );
                            case 'counterparties':
                              return (
                                <td key={col.key} className={`px-3 ${cellPad} max-w-[240px]`}>
                                  <div className="truncate font-medium text-slate-800 dark:text-slate-200" title={item.applicantName}>
                                    {item.applicantName}
                                  </div>
                                  <div className="truncate text-[11px] text-slate-500 dark:text-slate-400" title={item.beneficiaryName}>
                                    → {item.beneficiaryName}
                                  </div>
                                </td>
                              );
                            case 'amount':
                              return (
                                <td
                                  key={col.key}
                                  className={`px-3 ${cellPad} whitespace-nowrap text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100`}
                                >
                                  {item.amountFormatted}
                                </td>
                              );
                            case 'readiness':
                              return (
                                <td key={col.key} className={`px-3 ${cellPad} whitespace-nowrap`}>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">
                                        {m.filled}/{m.total}
                                      </span>
                                      {m.mandatoryEmpty > 0 ? (
                                        <span className="inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-400">
                                          <AlertCircle className="w-3.5 h-3.5" />
                                          {m.mandatoryEmpty} req empty
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          Ready
                                        </span>
                                      )}
                                    </div>
                                    <div className="w-28 h-1 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                      <div
                                        className={`h-full ${m.mandatoryEmpty > 0 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                                        style={{ width: `${m.completionPct}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                              );
                            case 'documents':
                              return (
                                <td key={col.key} className={`px-3 ${cellPad} whitespace-nowrap`}>
                                  {docDiscrepancy > 0 ? (
                                    <span className="inline-flex items-center gap-1 font-medium text-red-700 dark:text-red-400">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      <span>{docDiscrepancy} discrepancy</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                                      <FileCheck2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                      <span>
                                        {docVerified}/{docTotal} verified
                                      </span>
                                    </span>
                                  )}
                                </td>
                              );
                            case 'ageing':
                              return (
                                <td key={col.key} className={`px-3 ${cellPad} whitespace-nowrap`}>
                                  <div className="flex items-center gap-2">
                                    <span className="w-9 h-1.5 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                      <span
                                        className={`block h-full ${ageBarColor}`}
                                        style={{ width: `${Math.min(100, item.ageingDays * 10)}%` }}
                                      />
                                    </span>
                                    <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                                      {item.ageingLabel}
                                    </span>
                                  </div>
                                </td>
                              );
                            case 'sla':
                              return (
                                <td
                                  key={col.key}
                                  className={`px-3 ${cellPad} whitespace-nowrap font-mono tabular-nums ${
                                    item.slaRemainingMinutes <= 240
                                      ? 'text-red-700 dark:text-red-400 font-semibold'
                                      : 'text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  {item.slaLabel}
                                </td>
                              );
                            case 'priority':
                              return (
                                <td
                                  key={col.key}
                                  className={`px-3 ${cellPad} whitespace-nowrap font-semibold ${
                                    item.priority === 'High'
                                      ? 'text-red-700 dark:text-red-400'
                                      : item.priority === 'Medium'
                                      ? 'text-amber-700 dark:text-amber-400'
                                      : 'text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  {item.priority}
                                </td>
                              );
                            case 'assignedTo':
                              return (
                                <td key={col.key} className={`px-3 ${cellPad} whitespace-nowrap text-slate-700 dark:text-slate-300`}>
                                  {item.assignedTo}
                                </td>
                              );
                            case 'caseId':
                              return (
                                <td key={col.key} className={`px-3 ${cellPad} whitespace-nowrap font-mono text-slate-500 dark:text-slate-400`}>
                                  {item.caseId}
                                </td>
                              );
                            default:
                              return null;
                          }
                        })}

                        <td
                          className={`px-3 ${cellPad} whitespace-nowrap text-right`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenWorkItem(item.wobNum)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#97144D] text-white font-medium hover:bg-[#7A0E3D] transition-colors cursor-pointer"
                            >
                              <span>Work</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenCase360(item.caseId)}
                              title="Open Case 360° Folder"
                              className="p-1.5 rounded-md border border-[#E7D8DF] dark:border-[#3A2732] text-[#5E4E56] dark:text-[#CBBCC4] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] hover:text-[#97144D] cursor-pointer"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Queue Footer Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-[#EBDCE3] dark:border-[#32222B] bg-[#FBF2F6] dark:bg-[#22151C] text-[11px] text-[#6B5A63] dark:text-[#B9A7B0]">
            <span>
              Showing <strong className="text-slate-700 dark:text-slate-200">{filteredItems.length}</strong> of{' '}
              <strong className="text-slate-700 dark:text-slate-200">{basketItems.length}</strong> transactions in queue
            </span>
            <span>
              Click any transaction row to open its Work Page · Ageing: Green &lt;3d · Amber 3–6d · Red ≥7d
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
