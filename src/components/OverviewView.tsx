import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Gamepad2,
  Laptop,
  Lock,
  Play,
  ShieldCheck,
  Smartphone,
  Square,
  Timer,
} from 'lucide-react';
import { useClearline } from '../context/ClearlineContext';
import { formatMinutesHuman, WeeklyCharts } from './WeeklyCharts';

interface OverviewViewProps {
  onNavigate: (tab: 'overview' | 'ai-guard' | 'blocklists' | 'schedules' | 'analytics') => void;
}

function formatCountdown(msRemaining: number): string {
  const totalSec = Math.max(0, Math.ceil(msRemaining / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate }) => {
  const {
    profile,
    devices,
    blocklist,
    dailyStats,
    nowMs,
    isGamesAutoLocked,
    isDowntimeActive,
    isTimeoutActive,
    isLeisurePassActive,
    isFocusActive,
    isShortsAndSocialBlocked,
    startFocusTimer,
    cancelFocusTimer,
    completeFocusTimerNow,
    redeemRewardMinutes,
    toggleStrictMode,
  } = useClearline();

  const [selectedFocusDuration, setSelectedFocusDuration] = useState(25);
  const [redeemFeedback, setRedeemFeedback] = useState<string | null>(null);

  const weeklyTotals = useMemo(() => {
    return dailyStats.reduce(
      (acc, d) => ({
        educational: acc.educational + d.educationalMinutes,
        productive: acc.productive + d.productiveMinutes,
        socialShorts: acc.socialShorts + d.socialShortsMinutes,
        gaming: acc.gaming + d.gamingMinutes,
        timeouts: acc.timeouts + d.timeoutsTriggered,
        focusSessions: acc.focusSessions + d.focusSessionsCompleted,
      }),
      { educational: 0, productive: 0, socialShorts: 0, gaming: 0, timeouts: 0, focusSessions: 0 }
    );
  }, [dailyStats]);

  const totalWeeklyScreen =
    weeklyTotals.educational +
    weeklyTotals.productive +
    weeklyTotals.socialShorts +
    weeklyTotals.gaming;

  const focusRemainingMs = Math.max(0, profile.focusEndsAt - nowMs);
  const timeoutRemainingMs = Math.max(0, profile.timeoutActiveUntil - nowMs);
  const leisureRemainingMs = Math.max(0, profile.leisurePassUntil - nowMs);
  const shortFormBudgetPct = Math.min(100, (profile.shortFormMinutesToday / 10) * 100);
  const expectedReward = Math.max(2, Math.round(selectedFocusDuration * 0.4));

  const handleRedeem = async (minutes: number) => {
    const ok = await redeemRewardMinutes(minutes);
    if (ok) {
      setRedeemFeedback(`Activated ${minutes}-minute earned leisure pass across devices.`);
    } else if (isDowntimeActive || isFocusActive) {
      setRedeemFeedback('Cannot redeem leisure pass while Scheduled Downtime or Focus Timer is active.');
    } else {
      setRedeemFeedback('Not enough earned reward minutes. Complete a Focus Timer session first.');
    }
    setTimeout(() => setRedeemFeedback(null), 4000);
  };

  return (
    <div className="space-y-8">
      {/* Primary KPI Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Weekly Screen Time
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {formatMinutesHuman(totalWeeklyScreen)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {formatMinutesHuman(weeklyTotals.productive)} work ·{' '}
            {formatMinutesHuman(weeklyTotals.socialShorts + weeklyTotals.gaming)} leisure
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Educational Watch Time
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
            {formatMinutesHuman(weeklyTotals.educational)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Unlimited access · AI verified
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Shorts & Reels Budget Today
          </div>
          <div
            className={`mt-2 font-mono tabular-nums text-2xl font-semibold ${
              profile.shortFormMinutesToday >= 10
                ? 'text-red-600 dark:text-red-400'
                : profile.shortFormMinutesToday >= 7
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {profile.shortFormMinutesToday.toFixed(1)} / 10.0m
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full transition-all ${
                profile.shortFormMinutesToday >= 10
                  ? 'bg-red-600'
                  : profile.shortFormMinutesToday >= 7
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
              }`}
              style={{ width: `${shortFormBudgetPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Earned Reward Screen Time
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-semibold text-blue-600 dark:text-blue-400">
            {profile.rewardBankMinutes} min
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {weeklyTotals.focusSessions} focus sessions · {weeklyTotals.timeouts} timeouts triggered
          </div>
        </div>
      </section>

      {/* Main Workspace Split: Focus Reward Engine + Cross-OS Guard Status */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Focus Timer & Screen-Time Rewards */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Focus Timer & Screen-Time Rewards
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Complete deep focus blocks to earn extra leisure minutes.
                </p>
              </div>
              <Timer className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            </div>

            <div className="mt-6 flex flex-col items-center justify-center py-6 border-y border-slate-100 dark:border-slate-800">
              <div className="font-mono tabular-nums text-5xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {isFocusActive
                  ? formatCountdown(focusRemainingMs)
                  : `${String(selectedFocusDuration).padStart(2, '0')}:00`}
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {isFocusActive
                  ? `Focus shield active · +${Math.max(2, Math.round((profile.focusDurationMinutes || 25) * 0.4))}m reward upon completion`
                  : `Completion reward: +${expectedReward}m screen-time bank`}
              </div>

              {!isFocusActive && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {[1, 15, 25, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setSelectedFocusDuration(mins)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedFocusDuration === mins
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {mins === 1 ? '1m Sprint' : `${mins}m`}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {!isFocusActive ? (
                  <button
                    type="button"
                    onClick={() => startFocusTimer(selectedFocusDuration)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Start Focus Session
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={completeFocusTimerNow}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Claim Completion
                    </button>
                    <button
                      type="button"
                      onClick={cancelFocusTimer}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Square className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <Award className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>
                  Reward Bank:{' '}
                  <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {profile.rewardBankMinutes}m
                  </strong>
                  {isLeisurePassActive && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {' '}
                      · Pass active ({formatCountdown(leisureRemainingMs)})
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRedeem(10)}
                disabled={profile.rewardBankMinutes < 10}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                Redeem 10m Pass
              </button>
            </div>
            {redeemFeedback && (
              <p className="text-xs text-blue-600 dark:text-blue-400">{redeemFeedback}</p>
            )}
          </div>
        </div>

        {/* Live Enforcement & Cross-OS Sync Status */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Real-Time Enforcement & Device Sync
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Active across {devices.length} registered desktop & mobile operating systems.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleStrictMode}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  profile.strictModeEnabled
                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                Strict Lock: {profile.strictModeEnabled ? 'On' : 'Off'}
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Educational Content Policy
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      AI-verified lectures, tutorials, and coursework
                    </div>
                  </div>
                </div>
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                  Unlimited Access
                </span>
              </div>

              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Clock
                    className={`h-4 w-4 shrink-0 ${
                      isShortsAndSocialBlocked
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Shorts, Reels & Social Feeds
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {isTimeoutActive
                        ? `10m productivity timeout active · ${formatCountdown(timeoutRemainingMs)} remaining`
                        : isDowntimeActive
                          ? 'Locked by Scheduled Downtime'
                          : isFocusActive
                            ? 'Locked during active Focus Timer'
                            : `${Math.max(0, 10 - profile.shortFormMinutesToday).toFixed(1)}m remaining before automatic block`}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isShortsAndSocialBlocked
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isShortsAndSocialBlocked ? 'Blocked' : '10m Cap Active'}
                </span>
              </div>

              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Gamepad2
                    className={`h-4 w-4 shrink-0 ${
                      isGamesAutoLocked
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Unproductive Games Auto-Lock
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {isGamesAutoLocked
                        ? 'Automatically locked during working/study hours'
                        : 'Unlocked outside working/study hours'}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isGamesAutoLocked
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {isGamesAutoLocked ? 'Auto-Locked' : 'Permitted'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Synced Operating Systems ({blocklist.filter((r) => r.enabled).length} rules active)
              </span>
              <button
                type="button"
                onClick={() => onNavigate('ai-guard')}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap cursor-pointer"
              >
                Open AI Watch Guard
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {devices.slice(0, 4).map((dev) => (
                <div
                  key={dev.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100 truncate">
                    {dev.formFactor === 'desktop' ? (
                      <Laptop className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    ) : (
                      <Smartphone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    )}
                    <span className="truncate">{dev.os}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {dev.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Weekly Screen Time Overview */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              7-Day Screen Time & Distraction Analysis
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Click any day column to inspect educational, work, short-form, and gaming totals.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('analytics')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Full App Breakdown
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <WeeklyCharts stats={dailyStats} compact />
      </section>
    </div>
  );
};
