import React, { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useClearline } from '../context/ClearlineContext';
import { ContentCategory } from '../types';
import { formatMinutesHuman, WeeklyCharts } from './WeeklyCharts';

export const AnalyticsView: React.FC = () => {
  const { dailyStats, appUsage } = useClearline();
  const [catFilter, setCatFilter] = useState<'all' | ContentCategory>('all');
  const [search, setSearch] = useState('');

  const weeklyTotals = useMemo(() => {
    return dailyStats.reduce(
      (acc, d) => ({
        educational: acc.educational + d.educationalMinutes,
        productive: acc.productive + d.productiveMinutes,
        socialShorts: acc.socialShorts + d.socialShortsMinutes,
        gaming: acc.gaming + d.gamingMinutes,
        timeouts: acc.timeouts + d.timeoutsTriggered,
        focus: acc.focus + d.focusSessionsCompleted,
      }),
      { educational: 0, productive: 0, socialShorts: 0, gaming: 0, timeouts: 0, focus: 0 }
    );
  }, [dailyStats]);

  const totalWeekMinutes =
    weeklyTotals.educational +
    weeklyTotals.productive +
    weeklyTotals.socialShorts +
    weeklyTotals.gaming;

  const constructivePct =
    totalWeekMinutes > 0
      ? Math.round(
          ((weeklyTotals.educational + weeklyTotals.productive) / totalWeekMinutes) * 100
        )
      : 0;

  const filteredApps = useMemo(() => {
    return appUsage
      .filter((app) => {
        const matchesCat = catFilter === 'all' || app.category === catFilter;
        const q = search.trim().toLowerCase();
        const matchesQ =
          !q ||
          app.appName.toLowerCase().includes(q) ||
          app.domainOrPackage.toLowerCase().includes(q);
        return matchesCat && matchesQ;
      })
      .sort((a, b) => b.minutesThisWeek - a.minutesThisWeek);
  }, [appUsage, catFilter, search]);

  const maxAppMinutes = Math.max(60, ...appUsage.map((a) => a.minutesThisWeek));

  const exportCsv = () => {
    const header = 'Date,Educational_Min,Productive_Min,Shorts_Social_Min,Gaming_Min,Timeouts_Triggered,Focus_Sessions\n';
    const rows = dailyStats
      .map(
        (d) =>
          `${d.dateKey},${d.educationalMinutes},${d.productiveMinutes},${d.socialShortsMinutes},${d.gamingMinutes},${d.timeoutsTriggered},${d.focusSessionsCompleted}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clearline-weekly-analytics.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Weekly Metrics Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Overall Weekly Screen Time
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {formatMinutesHuman(totalWeekMinutes)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            7-day rolling window
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Productive & Educational Ratio
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
            {constructivePct}%
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatMinutesHuman(weeklyTotals.educational + weeklyTotals.productive)} constructive
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Shorts & Social Feeds
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-semibold text-amber-600 dark:text-amber-400">
            {formatMinutesHuman(weeklyTotals.socialShorts)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {weeklyTotals.timeouts} automatic 10m timeouts
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Gaming Time & Focus Streak
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {formatMinutesHuman(weeklyTotals.gaming)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {weeklyTotals.focus} focus sessions completed
          </div>
        </div>
      </section>

      {/* Stacked Daily Breakdown */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Weekly Overall Screen Time Distribution
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Daily totals across educational, productive, short-form social, and gaming categories.
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </button>
        </div>
        <WeeklyCharts stats={dailyStats} />
      </section>

      {/* App-by-App Breakdown Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Time Spent by App & Platform
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Aggregated cross-OS usage across desktop and mobile apps this week.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter apps..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit">
          {(
            [
              ['all', 'All Apps'],
              ['educational', 'Educational'],
              ['productive_work', 'Productive'],
              ['distracting_short_form', 'Shorts & Reels'],
              ['social_feed', 'Social'],
              ['gaming', 'Gaming'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCatFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                catFilter === key
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4">Application / Domain</th>
                <th className="py-3 px-4">Platforms</th>
                <th className="py-3 px-4">Policy Status</th>
                <th className="py-3 px-4 w-48">Weekly Share</th>
                <th className="py-3 pl-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredApps.map((app) => {
                const barWidth = Math.max(4, Math.round((app.minutesThisWeek / maxAppMinutes) * 100));
                const barColor =
                  app.category === 'educational'
                    ? 'bg-emerald-600'
                    : app.category === 'productive_work'
                      ? 'bg-blue-600'
                      : app.category === 'gaming'
                        ? 'bg-red-600'
                        : 'bg-amber-500';
                return (
                  <tr key={app.appName} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 pr-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {app.appName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {app.domainOrPackage}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {app.platforms.join(' · ')}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium">
                      <span
                        className={
                          app.policyStatus === 'Unlimited'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : app.policyStatus === 'Tracked'
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {app.policyStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className={`h-full ${barColor}`} style={{ width: `${barWidth}%` }} />
                      </div>
                    </td>
                    <td className="py-3.5 pl-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatMinutesHuman(app.minutesThisWeek)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
