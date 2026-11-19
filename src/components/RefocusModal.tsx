import React from 'react';
import { BookOpen, Play, ShieldAlert, Timer, X } from 'lucide-react';
import { useClearline } from '../context/ClearlineContext';

interface RefocusModalProps {
  onNavigateToFocus: () => void;
  onNavigateToAIGuard: () => void;
}

export const RefocusModal: React.FC<RefocusModalProps> = ({
  onNavigateToFocus,
  onNavigateToAIGuard,
}) => {
  const { refocusPrompt, dismissRefocusPrompt, startFocusTimer, stopWatchSession } =
    useClearline();

  if (!refocusPrompt) return null;

  const handleStartFocus = async () => {
    stopWatchSession();
    await startFocusTimer(25);
    dismissRefocusPrompt();
    onNavigateToFocus();
  };

  const handleSwitchEducational = () => {
    stopWatchSession();
    dismissRefocusPrompt();
    onNavigateToAIGuard();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="refocus-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                refocusPrompt.isTimeoutBlock
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                  : 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
              }`}
            >
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {refocusPrompt.triggerReason}
              </p>
              <h3
                id="refocus-modal-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {refocusPrompt.headline}
              </h3>
            </div>
          </div>
          {!refocusPrompt.isTimeoutBlock && (
            <button
              type="button"
              onClick={dismissRefocusPrompt}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              aria-label="Dismiss refocus nudge"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {refocusPrompt.message}
        </p>

        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 text-xs text-slate-700 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-slate-100">Suggested reset: </span>
          {refocusPrompt.microStep}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleSwitchEducational}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Switch to Educational
          </button>

          <button
            type="button"
            onClick={handleStartFocus}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Timer className="h-3.5 w-3.5" />
            Start 25m Focus (+10m Reward)
          </button>

          {!refocusPrompt.isTimeoutBlock && (
            <button
              type="button"
              onClick={dismissRefocusPrompt}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="h-3 w-3" />
              Continue for now
            </button>
          )}
          {refocusPrompt.isTimeoutBlock && (
            <button
              type="button"
              onClick={dismissRefocusPrompt}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Acknowledge Lock
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
