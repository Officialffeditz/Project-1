import React, { useMemo, useState } from 'react';
import { DailyStat } from '../types';

interface WeeklyChartsProps {
  stats: DailyStat[];
  compact?: boolean;
}

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-US', { weekday: 'short' });
}

export function formatMinutesHuman(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const WeeklyCharts: React.FC<WeeklyChartsProps> = ({ stats, compact = false }) => {
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const maxTotal = useMemo(() => {
    const totals = stats.map(
      (s) =>
        s.educationalMinutes +
        s.productiveMinutes +
        s.socialShortsMinutes +
        s.gamingMinutes
    );
    return Math.max(240, ...totals);
  }, [stats]);

  const activeDay = useMemo(() => {
    if (!stats.length) return null;
    if (selectedDateKey) {
      return stats.find((s) => s.dateKey === selectedDateKey) || stats[stats.length - 1];
    }
    return stats[stats.length - 1];
  }, [stats, selectedDateKey]);

  const chartHeight = compact ? 180 : 230;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-emerald-600" />
            Educational (Unlimited)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-blue-600" />
            Productive Work
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-amber-500" />
            Shorts, Reels & Social
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-red-600" />
            Gaming
          </span>
        </div>

        {activeDay && (
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {formatDayLabel(activeDay.dateKey)} ({activeDay.dateKey}) ·{' '}
            <span className="text-slate-900 dark:text-slate-100 font-medium">
              {formatMinutesHuman(
                activeDay.educationalMinutes +
                  activeDay.productiveMinutes +
                  activeDay.socialShortsMinutes +
                  activeDay.gamingMinutes
              )}
            </span>{' '}
            total
          </div>
        )}
      </div>

      <div className="mt-5">
        <div
          className="grid grid-cols-7 gap-3 items-end"
          style={{ height: `${chartHeight}px` }}
        >
          {stats.map((day) => {
            const total =
              day.educationalMinutes +
              day.productiveMinutes +
              day.socialShortsMinutes +
              day.gamingMinutes;
            const totalPct = Math.min(100, (total / maxTotal) * 100);
            const eduPct = total > 0 ? (day.educationalMinutes / total) * totalPct : 0;
            const prodPct = total > 0 ? (day.productiveMinutes / total) * totalPct : 0;
            const socPct = total > 0 ? (day.socialShortsMinutes / total) * totalPct : 0;
            const gamPct = total > 0 ? (day.gamingMinutes / total) * totalPct : 0;
            const isSelected = activeDay?.dateKey === day.dateKey;

            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => setSelectedDateKey(day.dateKey)}
                className="group flex flex-col items-center h-full justify-end focus:outline-none cursor-pointer"
                aria-label={`Inspect ${formatDayLabel(day.dateKey)} screen time`}
              >
                <span className="mb-1.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatMinutesHuman(total)}
                </span>
                <div
                  className={`w-full max-w-[44px] flex flex-col-reverse overflow-hidden rounded-t-md transition-opacity ${
                    isSelected
                      ? 'ring-2 ring-blue-600 ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
                      : 'opacity-90 group-hover:opacity-100'
                  }`}
                  style={{ height: `${Math.max(8, totalPct)}%` }}
                >
                  <div
                    className="w-full bg-blue-600"
                    style={{ height: `${totalPct > 0 ? (prodPct / totalPct) * 100 : 0}%` }}
                    title={`Productive: ${formatMinutesHuman(day.productiveMinutes)}`}
                  />
                  <div
                    className="w-full bg-emerald-600"
                    style={{ height: `${totalPct > 0 ? (eduPct / totalPct) * 100 : 0}%` }}
                    title={`Educational: ${formatMinutesHuman(day.educationalMinutes)}`}
                  />
                  <div
                    className="w-full bg-amber-500"
                    style={{ height: `${totalPct > 0 ? (socPct / totalPct) * 100 : 0}%` }}
                    title={`Shorts & Social: ${formatMinutesHuman(day.socialShortsMinutes)}`}
                  />
                  <div
                    className="w-full bg-red-600"
                    style={{ height: `${totalPct > 0 ? (gamPct / totalPct) * 100 : 0}%` }}
                    title={`Gaming: ${formatMinutesHuman(day.gamingMinutes)}`}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 grid grid-cols-7 gap-3 border-t border-slate-200 dark:border-slate-800 pt-2.5">
          {stats.map((day) => {
            const isSelected = activeDay?.dateKey === day.dateKey;
            return (
              <div
                key={day.dateKey}
                className={`text-center text-xs font-medium ${
                  isSelected
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {formatDayLabel(day.dateKey)}
              </div>
            );
          })}
        </div>
      </div>

      {activeDay && (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <div className="text-slate-500 dark:text-slate-400">Educational</div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {formatMinutesHuman(activeDay.educationalMinutes)}
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Productive Work</div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-blue-700 dark:text-blue-400">
              {formatMinutesHuman(activeDay.productiveMinutes)}
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Shorts & Social</div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-amber-700 dark:text-amber-400">
              {activeDay.socialShortsMinutes.toFixed(1)}m
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Gaming / Timeouts</div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-100">
              {formatMinutesHuman(activeDay.gamingMinutes)} · {activeDay.timeoutsTriggered} blocked
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
