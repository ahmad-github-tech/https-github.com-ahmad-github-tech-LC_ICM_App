import React from 'react';
import { LogOut, Moon, Sun, UserCheck } from 'lucide-react';
import type { AppView } from '../types/icm';

interface TopBarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  currentUser: string;
  onOpenUserModal: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  pendingCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onNavigate,
  currentUser,
  onOpenUserModal,
  isDark,
  onToggleTheme,
  pendingCount,
}) => {
  const navItems: { id: AppView; label: string }[] = [
    { id: 'inbox', label: `Inbox (${pendingCount})` },
    { id: 'work', label: 'Work Page' },
    { id: 'case', label: 'Case 360' },
    { id: 'search', label: 'LC Search' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-[#191116] border-b border-[#EBDCE3] dark:border-[#32222B] shadow-[0_2px_14px_-4px_rgba(151,20,77,0.1)]">
      {/* Signature Top Burgundy Ribbon */}
      <div
        aria-hidden="true"
        className="h-[3px] w-full bg-gradient-to-r from-[#6D0C36] via-[#97144D] to-[#D81B60]"
      />

      <div className="w-full pr-4 sm:pr-6 h-13 flex items-center justify-between gap-6">
        {/* Zone 1: Signature Angled Burgundy Brand Wing */}
        <button
          type="button"
          onClick={() => onNavigate('inbox')}
          className="brand-angled-wing h-full pl-4 sm:pl-6 pr-8 bg-gradient-to-r from-[#7D0F3E] to-[#97144D] hover:from-[#6D0C36] hover:to-[#871144] text-white flex items-center gap-2.5 text-sm sm:text-base font-bold tracking-tight whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="w-5 h-5 shrink-0 text-white"
            fill="currentColor"
          >
            <path d="M12 2L2 20h5.4l4.6-8.6L16.6 20H22L12 2zm0 9.6L9.4 16.5h5.2L12 11.6z" />
          </svg>
          <span>Meridian TradeFlow</span>
        </button>

        {/* Zone 2: Crisp Single-Line Banking Navigation */}
        <nav aria-label="Primary" className="flex items-center gap-5 sm:gap-7 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-3.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#97144D] dark:text-[#F48FB1] font-semibold'
                    : 'text-[#4B3F46] dark:text-[#CBBCC4] hover:text-[#97144D] dark:hover:text-[#F8BBD0]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#97144D] dark:bg-[#F48FB1] rounded-t"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme Toggle + Burgundy Login / Operator Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="p-2 rounded-lg border border-[#E7D8DF] dark:border-[#3B2833] text-[#5B4B53] dark:text-[#DECED6] hover:bg-[#FDF2F7] dark:hover:bg-[#2A1922] transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenUserModal}
            title="Switch Trade Finance operator or sign in"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#97144D] hover:bg-[#7A0E3D] text-white text-xs font-semibold whitespace-nowrap shrink-0 shadow-xs transition-colors cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{currentUser}</span>
            <LogOut className="w-3 h-3 opacity-80" />
          </button>
        </div>
      </div>
    </header>
  );
};
