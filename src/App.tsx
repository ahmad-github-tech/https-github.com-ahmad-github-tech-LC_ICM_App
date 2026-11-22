import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserCheck, X } from 'lucide-react';
import { AddCaseModal } from './components/AddCaseModal';
import { CasePageView } from './components/CasePageView';
import { Footer } from './components/Footer';
import { InboxView } from './components/InboxView';
import { SearchView } from './components/SearchView';
import { TopBar } from './components/TopBar';
import { WorkPageView } from './components/WorkPageView';
import { icmApi } from './services/icmApi';
import type {
  AppView,
  DocumentVerificationStatus,
  IcmInBasket,
  IcmWorkItem,
} from './types/icm';

interface OperatorPersona {
  name: string;
  role: string;
  defaultBasketId: string;
  branch: string;
}

const PERSONAS: OperatorPersona[] = [
  { name: 'Ahmad Jamal', role: 'LC Checker', defaultBasketId: 'all', branch: 'MUM-TF-001' },
  { name: 'Priya Nair', role: 'LC Maker', defaultBasketId: 'lc_issuance_maker', branch: 'DEL-TF-002' },
  { name: 'Rohan Mehta', role: 'Doc Examiner', defaultBasketId: 'doc_examination', branch: 'MUM-TF-001' },
  { name: 'S. Kulkarni', role: 'Compliance', defaultBasketId: 'standby_compliance', branch: 'BLR-TF-004' },
];

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('inbox');
  const [inBaskets, setInBaskets] = useState<IcmInBasket[]>([]);
  const [workItems, setWorkItems] = useState<IcmWorkItem[]>([]);
  const [activeBasketId, setActiveBasketId] = useState<string>('all');
  const [activeWobNum, setActiveWobNum] = useState<string>('');
  const [activeCaseId, setActiveCaseId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [personaIndex, setPersonaIndex] = useState<number>(0);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showAddCaseModal, setShowAddCaseModal] = useState<boolean>(false);
  const [recentlyCreatedCase, setRecentlyCreatedCase] = useState<IcmWorkItem | null>(null);

  const activePersona = PERSONAS[personaIndex];
  const currentPersonaLabel = `${activePersona.name} · ${activePersona.role}`;
  const actorName = activePersona.name;

  // Sync Tailwind dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDark]);

  // Global `/` shortcut to focus search in Inbox or Work Page
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        const target =
          activeView === 'inbox'
            ? document.getElementById('inbox-search-input')
            : document.getElementById('field-search-input');
        target?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView]);

  const loadWorkspaceData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [baskets, items] = await Promise.all([
        icmApi.getInBaskets(),
        icmApi.getWorkItems(),
      ]);
      setInBaskets(baskets);
      setWorkItems(items);
      if (items.length > 0) {
        setActiveWobNum((prev) => prev || items[0].wobNum);
        setActiveCaseId((prev) => prev || items[0].caseId);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to reach ICM Gateway API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const activeWorkItem = useMemo(
    () => workItems.find((w) => w.wobNum === activeWobNum) || workItems[0] || null,
    [workItems, activeWobNum]
  );

  const activeCaseItem = useMemo(
    () => workItems.find((w) => w.caseId === activeCaseId) || workItems[0] || null,
    [workItems, activeCaseId]
  );

  const replaceWorkItemInState = (updated: IcmWorkItem) => {
    setWorkItems((prev) => prev.map((w) => (w.wobNum === updated.wobNum ? updated : w)));
  };

  const handleOpenWorkItem = (wobNum: string) => {
    const found = workItems.find((w) => w.wobNum === wobNum);
    setActiveWobNum(wobNum);
    if (found) setActiveCaseId(found.caseId);
    setActiveView('work');
  };

  const handleOpenCase360 = (caseId: string) => {
    const found = workItems.find((w) => w.caseId === caseId || w.lcReference === caseId);
    if (found) {
      setActiveCaseId(found.caseId);
      setActiveWobNum(found.wobNum);
    } else {
      setActiveCaseId(caseId);
    }
    setActiveView('case');
  };

  const handleSaveFields = async (wobNum: string, fieldValues: Record<string, string>) => {
    const updated = await icmApi.saveFields(wobNum, fieldValues, actorName);
    replaceWorkItemInState(updated);
  };

  const handleCompleteStep = async (
    wobNum: string,
    outcome: string,
    reason: string,
    fieldValues: Record<string, string>
  ) => {
    const result = await icmApi.completeStep(wobNum, {
      outcome,
      reason,
      fieldValues,
      actor: actorName,
    });
    replaceWorkItemInState(result.updatedItem);
    if (result.nextWorkItem) {
      setActiveWobNum(result.nextWorkItem.wobNum);
      setActiveCaseId(result.nextWorkItem.caseId);
    } else {
      setActiveView('inbox');
    }
  };

  const handleReassignSingle = async (wobNum: string, targetUser: string) => {
    const updated = await icmApi.reassignWorkItem(wobNum, targetUser, actorName);
    replaceWorkItemInState(updated);
  };

  const handleReassignBatch = async (wobNums: string[], targetUser: string) => {
    const updatedList = await Promise.all(
      wobNums.map((wob) => icmApi.reassignWorkItem(wob, targetUser, actorName))
    );
    const map = new Map(updatedList.map((u) => [u.wobNum, u]));
    setWorkItems((prev) => prev.map((w) => map.get(w.wobNum) || w));
  };

  const handleUpdateDocumentStatus = async (
    caseId: string,
    docId: string,
    status: DocumentVerificationStatus,
    note: string
  ) => {
    const updated = await icmApi.updateDocumentStatus(caseId, docId, status, note, actorName);
    replaceWorkItemInState(updated);
  };

  const handleAddComment = async (caseId: string, message: string) => {
    const updated = await icmApi.addComment(caseId, message, actorName, activePersona.role);
    replaceWorkItemInState(updated);
  };

  const handleSignInAsPersona = (idx: number) => {
    setPersonaIndex(idx);
    setActiveBasketId(PERSONAS[idx].defaultBasketId);
    setActiveView('inbox');
    setShowLoginModal(false);
  };

  const handleCaseCreated = (created: IcmWorkItem) => {
    setWorkItems((prev) => [created, ...prev.filter((w) => w.wobNum !== created.wobNum)]);
    setActiveWobNum(created.wobNum);
    setActiveCaseId(created.caseId);
    setActiveBasketId(created.inBasketId || 'lc-maker');
    setRecentlyCreatedCase(created);
    setActiveView('inbox');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F8] dark:bg-[#120D11] text-[#1D161A] dark:text-[#F5EDF1]">
      <TopBar
        activeView={activeView}
        onNavigate={setActiveView}
        currentUser={currentPersonaLabel}
        onOpenUserModal={() => setShowLoginModal(true)}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        pendingCount={workItems.length}
      />

      {loading ? (
        <div className="flex-1 w-full px-6 py-8 space-y-4">
          <div className="h-8 w-64 rounded-lg bg-[#EFE4EA] dark:bg-[#2A1D24] animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-24 rounded-xl bg-[#EFE4EA] dark:bg-[#2A1D24] animate-pulse" />
            ))}
          </div>
          <div className="h-96 rounded-xl bg-[#EFE4EA] dark:bg-[#2A1D24] animate-pulse" />
        </div>
      ) : loadError ? (
        <div className="flex-1 max-w-xl mx-auto px-6 py-16 text-center space-y-3">
          <h2 className="text-base font-semibold text-red-700 dark:text-red-400">
            Unable to load IBM Case Manager Workspace
          </h2>
          <p className="text-xs text-[#6B5A63] dark:text-[#B9A7B0]">{loadError}</p>
          <button
            type="button"
            onClick={loadWorkspaceData}
            className="px-4 py-2 rounded-lg bg-[#97144D] text-white text-xs font-medium hover:bg-[#7A0E3D] cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <main className="flex-1">
          {activeView === 'inbox' && (
            <InboxView
              inBaskets={inBaskets}
              workItems={workItems}
              activeBasketId={activeBasketId}
              currentActorName={actorName}
              onSelectBasket={setActiveBasketId}
              onOpenWorkItem={handleOpenWorkItem}
              onOpenCase360={handleOpenCase360}
              onReassignBatch={handleReassignBatch}
              onOpenAddCase={() => setShowAddCaseModal(true)}
              recentlyCreatedCase={recentlyCreatedCase}
              onDismissCreatedBanner={() => setRecentlyCreatedCase(null)}
            />
          )}

          {activeView === 'work' && activeWorkItem && (
            <WorkPageView
              workItem={activeWorkItem}
              onBackToInbox={() => setActiveView('inbox')}
              onOpenCase360={handleOpenCase360}
              onSaveFields={handleSaveFields}
              onCompleteStep={handleCompleteStep}
              onReassign={handleReassignSingle}
              onUpdateDocumentStatus={handleUpdateDocumentStatus}
            />
          )}

          {activeView === 'case' && activeCaseItem && (
            <CasePageView
              caseItem={activeCaseItem}
              allCases={workItems}
              onBackToInbox={() => setActiveView('inbox')}
              onOpenWorkItem={handleOpenWorkItem}
              onSelectCase={handleOpenCase360}
              onAddComment={handleAddComment}
              onUpdateDocumentStatus={handleUpdateDocumentStatus}
            />
          )}

          {activeView === 'search' && (
            <SearchView
              allCases={workItems}
              onOpenWorkItem={handleOpenWorkItem}
              onOpenCase360={handleOpenCase360}
            />
          )}
        </main>
      )}

      {/* Operator Session Login / Role Switcher Modal */}
      {showLoginModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="operator-login-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#EBDCE3] dark:border-[#3A2732] bg-white dark:bg-[#191116] p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#97144D] dark:text-[#F48FB1]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>IBM ICM Trade Finance SSO</span>
                </div>
                <h2
                  id="operator-login-title"
                  className="text-base font-bold text-[#1D161A] dark:text-[#F5EDF1] mt-0.5"
                >
                  Switch Operator Session
                </h2>
                <p className="text-xs text-[#6B5A63] dark:text-[#B9A7B0] mt-0.5">
                  Signing in lands directly in your assigned In-Basket queue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                aria-label="Close session switcher"
                className="p-1.5 rounded-lg text-[#6B5A63] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {PERSONAS.map((p, idx) => {
                const isCurrent = idx === personaIndex;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleSignInAsPersona(idx)}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      isCurrent
                        ? 'border-[#97144D] bg-[#FDF1F6] dark:bg-[#3A1426]/60'
                        : 'border-[#EBDCE3] dark:border-[#32222B] hover:bg-[#FDF6F9] dark:hover:bg-[#261820]'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-[#1D161A] dark:text-[#F5EDF1]">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-[#6B5A63] dark:text-[#B9A7B0]">
                        {p.role} · Branch {p.branch}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        isCurrent
                          ? 'text-[#97144D] dark:text-[#F48FB1]'
                          : 'text-[#5E4E56] dark:text-[#CBBCC4]'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isCurrent ? 'Active' : 'Sign In'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <AddCaseModal
        isOpen={showAddCaseModal}
        actorName={actorName}
        onClose={() => setShowAddCaseModal(false)}
        onCaseCreated={handleCaseCreated}
      />

      <Footer
        onNavigate={setActiveView}
        onOpenAddCase={() => setShowAddCaseModal(true)}
      />
    </div>
  );
}
