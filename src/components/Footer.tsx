import React from 'react';
import type { AppView } from '../types/icm';

interface FooterProps {
  onNavigate: (view: AppView) => void;
  onOpenAddCase: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenAddCase }) => {
  return (
    <footer className="border-t-2 border-t-[#97144D] border-b border-[#EBDCE3] dark:border-b-[#32222B] bg-white dark:bg-[#191116] text-xs text-[#5E4E56] dark:text-[#B9A7B0]">
      <div className="w-full px-4 sm:px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-center md:text-left">
          <span className="font-bold text-[#97144D] dark:text-[#F48FB1] whitespace-nowrap">
            Meridian TradeFlow
          </span>
          <span aria-hidden="true">·</span>
          <span>Letter of Credit Operations Workstation</span>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => onNavigate('inbox')}
            className="hover:text-[#97144D] dark:hover:text-[#F48FB1] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Inbox Queue
          </button>
          <button
            type="button"
            onClick={() => onNavigate('work')}
            className="hover:text-[#97144D] dark:hover:text-[#F48FB1] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Work Page
          </button>
          <button
            type="button"
            onClick={() => onNavigate('case')}
            className="hover:text-[#97144D] dark:hover:text-[#F48FB1] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Case 360
          </button>
          <button
            type="button"
            onClick={() => onNavigate('search')}
            className="hover:text-[#97144D] dark:hover:text-[#F48FB1] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            LC Search
          </button>
          <button
            type="button"
            onClick={onOpenAddCase}
            className="font-semibold text-[#97144D] dark:text-[#F48FB1] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            + Add Case
          </button>
        </nav>

        <div className="text-[11px] text-[#786670] dark:text-[#9E8B95] whitespace-nowrap">
          IBM Case Manager · FileNet P8 · UCP 600 &amp; SWIFT MT700
        </div>
      </div>
    </footer>
  );
};
