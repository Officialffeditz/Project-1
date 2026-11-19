import React, { useState } from 'react';
import { CalendarClock, Gamepad2, Laptop, Plus, Smartphone, Trash2 } from 'lucide-react';
import { useClearline } from '../context/ClearlineContext';
import { ScheduleType } from '../types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const SchedulesView: React.FC = () => {
  const {
    schedules,
    devices,
    activeSchedules,
    isGamesAutoLocked,
    isDowntimeActive,
    effectiveDate,
    simulatedTimeHHMM,
    setSimulatedTimeHHMM,
    addSchedule,
    toggleSchedule,
    deleteSchedule,
  } = useClearline();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('work_study');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [days, setDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [lockGames, setLockGames] = useState(true);
  const [lockSocialAndShorts, setLockSocialAndShorts] = useState(false);

  const toggleDay = (day: string) => {
    setDays((prev) => {
      if (prev.includes(day)) {
        return prev.length > 1 ? prev.filter((d) => d !== day) : prev;
      }
      return [...prev, day];
    });
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await addSchedule({
      name: name.trim(),
      scheduleType,
      startTime,
      endTime,
      days,
      lockGames,
      lockSocialAndShorts,
      enabled: true,
    });
    setName('');
    setShowAdd(false);
  };

  const formattedClock = effectiveDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-8">
      {/* Live Schedule Evaluator & Time Simulator */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Scheduled Downtime & Work-Hours Game Locking
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Unproductive games lock automatically during working/study hours; downtime blocks all social feeds and reels.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            New Schedule
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Evaluated Clock</div>
            <div className="mt-1 font-mono tabular-nums text-lg font-semibold text-slate-900 dark:text-slate-100">
              {formattedClock}{' '}
              <span className="text-xs font-sans font-normal text-slate-500 dark:text-slate-400">
                {simulatedTimeHHMM ? '(Preview)' : '(Live)'}
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Game Lock Status</div>
            <div
              className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${
                isGamesAutoLocked
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              <Gamepad2 className="h-4 w-4 shrink-0" />
              {isGamesAutoLocked ? 'Games Automatically Locked' : 'Games Permitted'}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Downtime Status</div>
            <div
              className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${
                isDowntimeActive
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              <CalendarClock className="h-4 w-4 shrink-0" />
              {isDowntimeActive ? 'Downtime Active (All Feeds Blocked)' : 'Outside Downtime'}
            </div>
          </div>
        </div>

        {/* Interactive Time-of-Day Preview */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Preview schedule enforcement at:
          </span>
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            {(
              [
                [null, 'Live Clock'],
                ['10:30', '10:30 Work Hours'],
                ['19:30', '19:30 Evening'],
                ['23:00', '23:00 Downtime'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setSimulatedTimeHHMM(val)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  simulatedTimeHHMM === val
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {showAdd && (
          <form
            onSubmit={handleCreateSchedule}
            className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Schedule Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning Study Block"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Schedule Type
                </label>
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="work_study">Working / Study Hours</option>
                  <option value="downtime">Scheduled Downtime</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Start Time
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  End Time
                </label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {WEEKDAYS.map((day) => {
                  const active = days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockGames}
                    onChange={(e) => setLockGames(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Auto-lock Games
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockSocialAndShorts}
                    onChange={(e) => setLockSocialAndShorts(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Lock Social & Shorts
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-medium text-white dark:text-slate-900 cursor-pointer"
              >
                Save Schedule
              </button>
            </div>
          </form>
        )}

        {/* Schedules List */}
        <div className="mt-6 divide-y divide-slate-100 dark:divide-slate-800">
          {schedules.map((sched) => {
            const isActiveNow = activeSchedules.some((a) => a.id === sched.id);
            return (
              <div
                key={sched.id}
                className="py-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {sched.name}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        isActiveNow
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      · {isActiveNow ? 'Active Now' : sched.enabled ? 'Scheduled' : 'Paused'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {sched.startTime}–{sched.endTime} · {sched.days.join(', ')} ·{' '}
                    <span className="font-sans">
                      {sched.lockGames ? 'Locks Games' : 'Games Allowed'} ·{' '}
                      {sched.lockSocialAndShorts ? 'Locks Social & Shorts' : '10m Cap on Shorts'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSchedule(sched.id)}
                    className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {sched.enabled ? 'Pause' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSchedule(sched.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    aria-label={`Delete ${sched.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Synced Cross-OS Devices */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Synced Desktop & Mobile Devices
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Timeouts, custom blocklists, and work-hour game locks propagate across every linked OS endpoint.
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {devices.map((dev) => (
            <div key={dev.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                {dev.formFactor === 'desktop' ? (
                  <Laptop className="h-4 w-4 text-slate-500 shrink-0" />
                ) : (
                  <Smartphone className="h-4 w-4 text-slate-500 shrink-0" />
                )}
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{dev.name}</div>
                  <div className="text-slate-500 dark:text-slate-400">
                    {dev.os} · {dev.formFactor}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-emerald-700 dark:text-emerald-400">
                  {dev.enforcementActive ? 'Rules Synced' : 'Standby'}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400">
                  Last heartbeat {new Date(dev.lastSeenAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
