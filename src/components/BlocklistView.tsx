import React, { useMemo, useState } from 'react';
import { Check, Copy, Lock, Plus, Search, Shield, Trash2, X } from 'lucide-react';
import { useClearline } from '../context/ClearlineContext';
import { BlockRule, OSPlatform, RuleCategory, RuleMode } from '../types';

const ALL_PLATFORMS: OSPlatform[] = ['macOS', 'Windows', 'Linux', 'iOS', 'Android'];

export const BlocklistView: React.FC = () => {
  const {
    profile,
    blocklist,
    isTimeoutActive,
    isDowntimeActive,
    addBlockRule,
    toggleBlockRule,
    deleteBlockRule,
  } = useClearline();

  const [filterCat, setFilterCat] = useState<'all' | RuleCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const [target, setTarget] = useState('');
  const [pattern, setPattern] = useState('');
  const [category, setCategory] = useState<RuleCategory>('custom');
  const [mode, setMode] = useState<RuleMode>('strict_lock');
  const [platforms, setPlatforms] = useState<OSPlatform[]>(ALL_PLATFORMS);

  const [strictChallenge, setStrictChallenge] = useState<{
    action: 'toggle' | 'delete';
    rule: BlockRule;
  } | null>(null);
  const [challengeInput, setChallengeInput] = useState('');
  const [copiedHosts, setCopiedHosts] = useState(false);

  const filteredRules = useMemo(() => {
    return blocklist.filter((rule) => {
      const matchesCat = filterCat === 'all' || rule.category === filterCat;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        rule.target.toLowerCase().includes(q) ||
        rule.pattern.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [blocklist, filterCat, searchQuery]);

  const togglePlatform = (os: OSPlatform) => {
    setPlatforms((prev) => {
      if (prev.includes(os)) {
        return prev.length > 1 ? prev.filter((p) => p !== os) : prev;
      }
      return [...prev, os];
    });
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target.trim() || !pattern.trim()) return;
    await addBlockRule({
      target: target.trim(),
      pattern: pattern.trim(),
      category,
      mode,
      enabled: true,
      platforms,
    });
    setTarget('');
    setPattern('');
    setShowAddForm(false);
  };

  const requestRuleAction = (action: 'toggle' | 'delete', rule: BlockRule) => {
    const needsFriction =
      profile.strictModeEnabled &&
      rule.enabled &&
      (rule.mode === 'strict_lock' || isTimeoutActive || isDowntimeActive);

    if (needsFriction) {
      setChallengeInput('');
      setStrictChallenge({ action, rule });
      return;
    }

    if (action === 'toggle') {
      toggleBlockRule(rule.id);
    } else {
      deleteBlockRule(rule.id);
    }
  };

  const confirmStrictChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strictChallenge) return;
    if (challengeInput.trim().toUpperCase() !== 'STAY FOCUSED') return;

    if (strictChallenge.action === 'toggle') {
      await toggleBlockRule(strictChallenge.rule.id);
    } else {
      await deleteBlockRule(strictChallenge.rule.id);
    }
    setStrictChallenge(null);
    setChallengeInput('');
  };

  const hostsSnippet = useMemo(() => {
    const domains = blocklist
      .filter((r) => r.enabled)
      .map((r) => r.pattern.split('/')[0].replace(/\*|\s/g, ''))
      .filter((d) => d.includes('.'));
    const unique = Array.from(new Set(domains));
    return unique.map((d) => `0.0.0.0 ${d}\n0.0.0.0 www.${d}`).join('\n');
  }, [blocklist]);

  const handleCopyHosts = async () => {
    try {
      await navigator.clipboard.writeText(hostsSnippet);
      setCopiedHosts(true);
      setTimeout(() => setCopiedHosts(false), 2500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Controls & Filter Bar */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Custom Blocklist & Strict Rules
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Manage blocked apps, domains, short-form feeds, and games synced across all operating systems.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((s) => !s)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Block Rule
          </button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddRule}
            className="mt-5 pb-6 border-b border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  App or Site Name
                </label>
                <input
                  type="text"
                  required
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="e.g. Twitch Streams"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Domain, URL or Process
                </label>
                <input
                  type="text"
                  required
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="e.g. twitch.tv"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RuleCategory)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="short_form">Short-Form & Reels</option>
                  <option value="social_feed">Social Media Feed</option>
                  <option value="gaming">Gaming</option>
                  <option value="custom">Custom Website / App</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Enforcement Mode
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as RuleMode)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="strict_lock">Strict Lock (No Bypass)</option>
                  <option value="timeout_10m">10-Minute Timeout Cap</option>
                  <option value="work_hours_lock">Work-Hours Auto-Lock</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Target OS:
                </span>
                {ALL_PLATFORMS.map((os) => {
                  const selected = platforms.includes(os);
                  return (
                    <button
                      key={os}
                      type="button"
                      onClick={() => togglePlatform(os)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selected
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {os}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 cursor-pointer"
                >
                  Save Rule
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Filter Bar + Search */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            {(
              [
                ['all', 'All Rules'],
                ['short_form', 'Shorts & Reels'],
                ['social_feed', 'Social Feeds'],
                ['gaming', 'Gaming'],
                ['custom', 'Custom'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterCat(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filterCat === key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search app or domain..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Rules Table */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4">Target & Pattern</th>
                <th className="py-3 px-4">Enforcement</th>
                <th className="py-3 px-4">Platforms</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 pl-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-3.5 pr-4">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {rule.target}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {rule.pattern}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {rule.mode === 'strict_lock'
                      ? 'Strict Lock'
                      : rule.mode === 'timeout_10m'
                        ? '10-Min Timeout Cap'
                        : 'Work-Hours Auto-Lock'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                    {rule.platforms.join(' · ')}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-medium">
                    <span
                      className={
                        rule.enabled
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }
                    >
                      {rule.enabled ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => requestRuleAction('toggle', rule)}
                        className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => requestRuleAction('delete', rule)}
                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                        aria-label={`Delete ${rule.target}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRules.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No blocklist rules match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cross-OS Hosts & DNS Enforcement Export */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Cross-OS System Enforcement Rules
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Apply active rules at the OS network layer on macOS, Windows, Linux, iOS, and Android.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyHosts}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedHosts ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedHosts ? 'Copied Rules' : 'Copy Hosts Block'}
          </button>
        </div>

        <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 font-mono text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {hostsSnippet || '# No active domain patterns enabled.'}
        </pre>
      </section>

      {/* Strict Lock Friction Modal */}
      {strictChallenge && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100">
                <Lock className="h-4 w-4 text-red-600 dark:text-red-400" />
                <h3 className="text-base font-semibold">Strict Lock Confirmation</h3>
              </div>
              <button
                type="button"
                onClick={() => setStrictChallenge(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Cancel strict confirmation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Strict Lock is enabled for <strong>{strictChallenge.rule.target}</strong>. To prevent impulsive unblocking, type{' '}
              <code className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                STAY FOCUSED
              </code>{' '}
              below to confirm.
            </p>
            <form onSubmit={confirmStrictChallenge} className="mt-4 space-y-4">
              <input
                type="text"
                value={challengeInput}
                onChange={(e) => setChallengeInput(e.target.value)}
                placeholder="Type STAY FOCUSED"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStrictChallenge(null)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Keep Locked
                </button>
                <button
                  type="submit"
                  disabled={challengeInput.trim().toUpperCase() !== 'STAY FOCUSED'}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Confirm Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
