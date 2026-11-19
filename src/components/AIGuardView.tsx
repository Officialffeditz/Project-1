import React, { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Eye,
  FastForward,
  Image as ImageIcon,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { useClearline } from '../context/ClearlineContext';
import { AIAnalysisResult } from '../types';

interface MediaPreset {
  label: string;
  title: string;
  appOrDomain: string;
  url: string;
  description: string;
}

const MEDIA_PRESETS: MediaPreset[] = [
  {
    label: 'Educational Lecture',
    title: 'Stanford CS229 Machine Learning — Gradient Descent & Convex Optimization',
    appOrDomain: 'youtube.com/watch',
    url: 'https://www.youtube.com/watch?v=cs229-lecture',
    description: 'Full university lecture covering batch gradient descent and normal equations.',
  },
  {
    label: 'YouTube Shorts Feed',
    title: '10 Craziest Pranks & Viral Dance Challenge Shorts Compilation',
    appOrDomain: 'youtube.com/shorts',
    url: 'https://www.youtube.com/shorts/viral-pranks-99',
    description: 'Rapid-fire vertical short-form entertainment clips.',
  },
  {
    label: 'Instagram Reels',
    title: 'Endless Memes & Celebrity Drama Reels',
    appOrDomain: 'instagram.com/reels',
    url: 'https://www.instagram.com/reels/',
    description: 'Infinite scrolling vertical short video feed.',
  },
  {
    label: 'Competitive Game',
    title: 'Valorant Ranked Match — Riot Client',
    appOrDomain: 'valorant.exe',
    url: 'riotclient://valorant',
    description: 'Multiplayer tactical shooter desktop game.',
  },
];

export const AIGuardView: React.FC = () => {
  const {
    profile,
    activityLogs,
    isGamesAutoLocked,
    isDowntimeActive,
    isFocusActive,
    isShortsAndSocialBlocked,
    activeWatchSession,
    startWatchSessionFromAnalysis,
    toggleWatchSessionRunning,
    advanceWatchMinutes,
    stopWatchSession,
    resetShortFormTimeoutForDemo,
  } = useClearline();

  const [title, setTitle] = useState(MEDIA_PRESETS[1].title);
  const [appOrDomain, setAppOrDomain] = useState(MEDIA_PRESETS[1].appOrDomain);
  const [url, setUrl] = useState(MEDIA_PRESETS[1].url);
  const [description, setDescription] = useState(MEDIA_PRESETS[1].description);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AIAnalysisResult | null>(null);

  const applyPreset = (preset: MediaPreset) => {
    setTitle(preset.title);
    setAppOrDomain(preset.appOrDomain);
    setUrl(preset.url);
    setDescription(preset.description);
    setAnalysisError(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      const parts = result.split(',');
      if (parts.length === 2) {
        setImageBase64(parts[1]);
        setImageMimeType(file.type || 'image/png');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const response = await fetch('/api/analyze-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          appOrDomain,
          url,
          description,
          imageBase64,
          imageMimeType,
          context: {
            shortFormMinutesToday: profile.shortFormMinutesToday,
            inWorkHours: isGamesAutoLocked,
            inDowntime: isDowntimeActive,
            activeFocusSession: isFocusActive,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to classify content.');
      }
      setLastResult(data as AIAnalysisResult);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Unable to reach AI content inspector.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartWatching = async () => {
    if (!lastResult) return;
    await startWatchSessionFromAnalysis(title || appOrDomain, appOrDomain || url, lastResult);
  };

  const elapsedMin = activeWatchSession
    ? (activeWatchSession.elapsedSeconds / 60).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* AI Watch Classifier Form */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                AI Content Detection Inspector
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Gemini inspects what you are watching to allow educational media unlimitedly while gating distracting shorts, reels, and work-hour games.
              </p>
            </div>
            <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Quick scenarios:
            </span>
            {MEDIA_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleInspect} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Video / Stream / Window Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. MIT Linear Algebra Lecture or Funny Cat Shorts"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  App or Domain
                </label>
                <input
                  type="text"
                  value={appOrDomain}
                  onChange={(e) => setAppOrDomain(e.target.value)}
                  placeholder="e.g. youtube.com/shorts, instagram.com, valorant.exe"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                URL or Activity Context
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Description or Transcript Snippet (optional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0">
                <ImageIcon className="h-3.5 w-3.5" />
                {imagePreview ? 'Change Screen Frame' : 'Attach Screen Frame (Optional)'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              <button
                type="submit"
                disabled={isAnalyzing}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isAnalyzing ? 'Analyzing Media...' : 'Classify with AI Guard'}
              </button>
            </div>

            {imagePreview && (
              <div className="flex items-center gap-3 pt-2">
                <img
                  src={imagePreview}
                  alt="Attached media frame"
                  referrerPolicy="no-referrer"
                  className="h-14 w-24 rounded-md object-cover border border-slate-200 dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setImageBase64(undefined);
                    setImageMimeType(undefined);
                  }}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                >
                  Remove frame
                </button>
              </div>
            )}
          </form>

          {analysisError && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-3.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{analysisError}</span>
            </div>
          )}

          {lastResult && (
            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {lastResult.isEducational ? (
                    <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  )}
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {lastResult.category === 'educational'
                        ? 'Educational Content — Unlimited Access'
                        : lastResult.category === 'productive_work'
                          ? 'Productive Work — Allowed'
                          : lastResult.category === 'distracting_short_form'
                            ? 'Distracting Short-Form / Reels — 10-Min Timeout Tracked'
                            : lastResult.category === 'gaming'
                              ? 'Unproductive Gaming'
                              : 'Social Media Feed'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      Confidence: {Math.round(lastResult.confidence * 100)}% · Action:{' '}
                      {lastResult.recommendedAction.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartWatching}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5" />
                  Simulate / Start Watch Session
                </button>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {lastResult.reasoning}
              </p>

              {!lastResult.isEducational && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Gentle Refocus Prompt
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                      {lastResult.gentlePrompt}
                    </p>
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Suggested Educational Pivot
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                      {lastResult.educationalAlternative}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Live Watch Monitor & 10-Min Timeout Meter */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Live Watch Monitor
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Tracks active watch time against your 10-minute short-form timeout.
              </p>
            </div>
            <ShieldCheck
              className={`h-5 w-5 shrink-0 ${
                isShortsAndSocialBlocked
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300">
                Daily Shorts / Reels Budget
              </span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                {profile.shortFormMinutesToday.toFixed(1)} / 10.0 min
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full transition-all ${
                  profile.shortFormMinutesToday >= 10
                    ? 'bg-red-600'
                    : profile.shortFormMinutesToday >= 7
                      ? 'bg-amber-500'
                      : 'bg-blue-600'
                }`}
                style={{
                  width: `${Math.min(100, (profile.shortFormMinutesToday / 10) * 100)}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>7m: Gentle Refocus Prompt</span>
              <span>10m: Hard Productivity Timeout</span>
            </div>
          </div>

          {activeWatchSession ? (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Currently Watching · {activeWatchSession.appOrDomain}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {activeWatchSession.title}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Session Elapsed</div>
                  <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {elapsedMin} min
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Policy</div>
                  <div
                    className={`text-xs font-semibold ${
                      activeWatchSession.category === 'educational'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {activeWatchSession.category === 'educational'
                      ? 'Unlimited Educational'
                      : 'Metered & Protected'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleWatchSessionRunning}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {activeWatchSession.isRunning ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Resume
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => advanceWatchMinutes(3)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FastForward className="h-3.5 w-3.5" />
                  +3m Watch Step
                </button>

                <button
                  type="button"
                  onClick={stopWatchSession}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Classify any video, Short, Reel, or game on the left, then click{' '}
              <strong>Simulate / Start Watch Session</strong> to observe real-time AI nudges and automatic 10-minute timeouts.
            </div>
          )}

          {isShortsAndSocialBlocked && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="text-xs font-medium text-red-600 dark:text-red-400">
                Shorts, Reels & social feeds are currently locked.
              </div>
              <button
                type="button"
                onClick={resetShortFormTimeoutForDemo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Daily Counter
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Recent AI Inspection & Enforcement Log */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              AI Inspection & Enforcement Log
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Synced timeline of classified media, gentle prompts, and automatic blocks across devices.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {activityLogs.length} events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4">Content / App</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">OS</th>
                <th className="py-3 pl-4 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {activityLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {log.title}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                      {log.appOrDomain} · {log.aiReasoning}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {log.category.replace(/_/g, ' ')}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap font-medium">
                    <span
                      className={
                        log.actionTaken === 'allowed_unlimited' ||
                        log.actionTaken === 'focus_completed'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : log.actionTaken === 'gentle_nudge'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {log.actionTaken.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {log.deviceOs}
                  </td>
                  <td className="py-3 pl-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {log.durationMinutes.toFixed(1)}m
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
