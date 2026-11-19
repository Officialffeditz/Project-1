import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, LogOut, Moon, Sun } from 'lucide-react';
import { ClearlineProvider, useClearline } from './context/ClearlineContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OverviewView } from './components/OverviewView';
import { AIGuardView } from './components/AIGuardView';
import { BlocklistView } from './components/BlocklistView';
import { SchedulesView } from './components/SchedulesView';
import { AnalyticsView } from './components/AnalyticsView';
import { RefocusModal } from './components/RefocusModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

type TabKey = 'overview' | 'ai-guard' | 'blocklists' | 'schedules' | 'analytics';

const NAV_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'ai-guard', label: 'AI Guard' },
  { key: 'blocklists', label: 'Blocklists' },
  { key: 'schedules', label: 'Schedules' },
  { key: 'analytics', label: 'Analytics' },
];

const ClearlineShell: React.FC = () => {
  const {
    authUser,
    isCloudSynced,
    syncError,
    isGamesAutoLocked,
    isShortsAndSocialBlocked,
    isFocusActive,
    signIn,
    signOut,
  } = useClearline();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('clearline_theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('clearline_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('clearline_theme', 'light');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Three-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Clearline
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-blue-600 text-slate-900 dark:text-slate-100'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="shrink-0">
            {authUser ? (
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={signIn}
                className="rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign in to Sync
              </button>
            )}
          </div>
        </div>

        {/* Mobile navigation strip */}
        <div className="md:hidden border-t border-slate-100 dark:border-slate-800 px-4 overflow-x-auto flex items-center gap-4">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'border-blue-600 text-slate-900 dark:text-slate-100'
                    : 'border-transparent text-slate-500 dark:text-slate-400'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Workspace Sub-Toolbar */}
      <div className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-medium">
              {isCloudSynced ? (
                <>
                  <Cloud className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-slate-900 dark:text-slate-100">
                    Synced ({authUser?.email})
                  </span>
                </>
              ) : (
                <>
                  <CloudOff className="h-3.5 w-3.5 text-slate-400" />
                  <span>Local Workspace · Sign in for cross-device sync</span>
                </>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Games: {isGamesAutoLocked ? 'Auto-Locked' : 'Permitted'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Shorts & Feeds: {isShortsAndSocialBlocked ? 'Blocked' : '10m Cap'}
            </span>
            {isFocusActive && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  Focus Timer Active
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              aria-label="Toggle color theme"
            >
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {isDark ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </div>

      {syncError && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 px-4 py-2.5 text-xs text-red-700 dark:text-red-300">
            {syncError}
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewView onNavigate={setActiveTab} />}
        {activeTab === 'ai-guard' && <AIGuardView />}
        {activeTab === 'blocklists' && <BlocklistView />}
        {activeTab === 'schedules' && <SchedulesView />}
        {activeTab === 'analytics' && <AnalyticsView />}
      </main>

      <RefocusModal
        onNavigateToFocus={() => setActiveTab('overview')}
        onNavigateToAIGuard={() => setActiveTab('ai-guard')}
      />
      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ClearlineProvider>
        <ClearlineShell />
      </ClearlineProvider>
    </ErrorBoundary>
  );
}
