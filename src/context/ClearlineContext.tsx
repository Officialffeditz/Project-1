import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
  testConnection,
} from '../firebase';
import {
  ActionTaken,
  ActivityLog,
  AIAnalysisResult,
  AppUsageSummary,
  BlockRule,
  ContentCategory,
  DailyStat,
  DowntimeSchedule,
  OSPlatform,
  SyncedDevice,
  UserProfileState,
} from '../types';
import {
  createInitialActivityLogs,
  createInitialBlocklist,
  createInitialDailyStats,
  createInitialDevices,
  createInitialProfile,
  createInitialSchedules,
  detectCurrentDevice,
  formatDateKey,
  INITIAL_APP_USAGE_BASE,
  isScheduleActiveAt,
} from '../utils/defaults';

export interface ActiveWatchSession {
  title: string;
  appOrDomain: string;
  category: ContentCategory;
  elapsedSeconds: number;
  isRunning: boolean;
  aiReasoning: string;
  educationalAlternative: string;
}

export interface RefocusPromptState {
  headline: string;
  message: string;
  microStep: string;
  triggerReason: string;
  isTimeoutBlock: boolean;
}

interface ClearlineContextValue {
  authUser: User | null;
  authReady: boolean;
  isCloudSynced: boolean;
  syncError: string | null;
  profile: UserProfileState;
  devices: SyncedDevice[];
  blocklist: BlockRule[];
  schedules: DowntimeSchedule[];
  activityLogs: ActivityLog[];
  dailyStats: DailyStat[];
  appUsage: AppUsageSummary[];
  nowMs: number;
  simulatedTimeHHMM: string | null;
  setSimulatedTimeHHMM: (hhmm: string | null) => void;
  effectiveDate: Date;
  activeSchedules: DowntimeSchedule[];
  isGamesAutoLocked: boolean;
  isDowntimeActive: boolean;
  isTimeoutActive: boolean;
  isLeisurePassActive: boolean;
  isFocusActive: boolean;
  isShortsAndSocialBlocked: boolean;
  activeWatchSession: ActiveWatchSession | null;
  refocusPrompt: RefocusPromptState | null;
  dismissRefocusPrompt: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  toggleStrictMode: () => Promise<void>;
  startFocusTimer: (durationMinutes: number) => Promise<void>;
  cancelFocusTimer: () => Promise<void>;
  completeFocusTimerNow: () => Promise<void>;
  redeemRewardMinutes: (minutes: number) => Promise<boolean>;
  addBlockRule: (rule: Omit<BlockRule, 'id' | 'ownerId'>) => Promise<void>;
  toggleBlockRule: (ruleId: string) => Promise<void>;
  deleteBlockRule: (ruleId: string) => Promise<void>;
  addSchedule: (sched: Omit<DowntimeSchedule, 'id' | 'ownerId'>) => Promise<void>;
  toggleSchedule: (scheduleId: string) => Promise<void>;
  deleteSchedule: (scheduleId: string) => Promise<void>;
  startWatchSessionFromAnalysis: (
    title: string,
    appOrDomain: string,
    analysis: AIAnalysisResult
  ) => Promise<void>;
  toggleWatchSessionRunning: () => void;
  advanceWatchMinutes: (minutes: number) => Promise<void>;
  stopWatchSession: () => void;
  resetShortFormTimeoutForDemo: () => Promise<void>;
}

const ClearlineContext = createContext<ClearlineContextValue | null>(null);

const LOCAL_STORAGE_KEY = 'clearline_workspace_v1';

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '');
}

export const ClearlineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [simulatedTimeHHMM, setSimulatedTimeHHMM] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfileState>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.profile) return parsed.profile;
      }
    } catch {
      // Ignore corrupt cache
    }
    return createInitialProfile();
  });

  const [devices, setDevices] = useState<SyncedDevice[]>(() => createInitialDevices());
  const [blocklist, setBlocklist] = useState<BlockRule[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.blocklist)) return parsed.blocklist;
      }
    } catch {
      // Ignore
    }
    return createInitialBlocklist();
  });

  const [schedules, setSchedules] = useState<DowntimeSchedule[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.schedules)) return parsed.schedules;
      }
    } catch {
      // Ignore
    }
    return createInitialSchedules();
  });

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.activityLogs)) return parsed.activityLogs;
      }
    } catch {
      // Ignore
    }
    return createInitialActivityLogs();
  });

  const [dailyStats, setDailyStats] = useState<DailyStat[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.dailyStats)) return parsed.dailyStats;
      }
    } catch {
      // Ignore
    }
    return createInitialDailyStats();
  });

  const [activeWatchSession, setActiveWatchSession] = useState<ActiveWatchSession | null>(null);
  const [refocusPrompt, setRefocusPrompt] = useState<RefocusPromptState | null>(null);
  const nudgedThisSessionRef = useRef(false);
  const timedOutThisSessionRef = useRef(false);
  const completingFocusRef = useRef(false);

  // Persist local state when signed out
  useEffect(() => {
    if (authUser) return;
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({ profile, blocklist, schedules, activityLogs, dailyStats })
      );
    } catch {
      // Ignore quota issues
    }
  }, [authUser, profile, blocklist, schedules, activityLogs, dailyStats]);

  // Startup connection check
  useEffect(() => {
    testConnection();
  }, []);

  // Auth listener & Firestore seeding/subscriptions
  useEffect(() => {
    let unsubs: Array<() => void> = [];

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      unsubs.forEach((fn) => fn());
      unsubs = [];
      setAuthUser(user);
      setAuthReady(true);
      setSyncError(null);

      if (!user) return;

      const uid = user.uid;
      const userDocRef = doc(db, 'users', uid);

      try {
        const existingSnap = await getDoc(userDocRef);
        const currentDev = detectCurrentDevice();

        if (!existingSnap.exists()) {
          // Create parent user doc first (required by Master Gate rules)
          await setDoc(userDocRef, {
            uid,
            displayName: user.displayName || 'Clearline User',
            email: user.email || 'user@clearline.app',
            rewardBankMinutes: Math.round(profile.rewardBankMinutes),
            shortFormMinutesToday: Number(profile.shortFormMinutesToday.toFixed(2)),
            timeoutActiveUntil: Math.round(profile.timeoutActiveUntil),
            leisurePassUntil: Math.round(profile.leisurePassUntil),
            strictModeEnabled: Boolean(profile.strictModeEnabled),
            focusEndsAt: Math.round(profile.focusEndsAt),
            focusDurationMinutes: Math.round(profile.focusDurationMinutes),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const batch = writeBatch(db);

          createInitialDevices(uid).forEach((dev) => {
            batch.set(doc(db, 'users', uid, 'devices', dev.id), {
              id: dev.id,
              ownerId: uid,
              name: dev.name,
              os: dev.os,
              formFactor: dev.formFactor,
              enforcementActive: dev.enforcementActive,
              lastSeenAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            });
          });

          blocklist.forEach((rule) => {
            const id = rule.id.replace(/[^a-zA-Z0-9_\-]/g, '');
            batch.set(doc(db, 'users', uid, 'blocklist', id), {
              id,
              ownerId: uid,
              target: rule.target,
              pattern: rule.pattern,
              category: rule.category,
              mode: rule.mode,
              enabled: rule.enabled,
              platforms: rule.platforms,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          schedules.forEach((sched) => {
            const id = sched.id.replace(/[^a-zA-Z0-9_\-]/g, '');
            batch.set(doc(db, 'users', uid, 'schedules', id), {
              id,
              ownerId: uid,
              name: sched.name,
              scheduleType: sched.scheduleType,
              startTime: sched.startTime,
              endTime: sched.endTime,
              days: sched.days,
              lockGames: sched.lockGames,
              lockSocialAndShorts: sched.lockSocialAndShorts,
              enabled: sched.enabled,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          dailyStats.forEach((stat) => {
            batch.set(doc(db, 'users', uid, 'dailyStats', stat.dateKey), {
              dateKey: stat.dateKey,
              ownerId: uid,
              educationalMinutes: Number(stat.educationalMinutes.toFixed(1)),
              productiveMinutes: Number(stat.productiveMinutes.toFixed(1)),
              socialShortsMinutes: Number(stat.socialShortsMinutes.toFixed(1)),
              gamingMinutes: Number(stat.gamingMinutes.toFixed(1)),
              timeoutsTriggered: Math.round(stat.timeoutsTriggered),
              focusSessionsCompleted: Math.round(stat.focusSessionsCompleted),
              updatedAt: serverTimestamp(),
            });
          });

          activityLogs.slice(0, 6).forEach((log) => {
            const id = log.id.replace(/[^a-zA-Z0-9_\-]/g, '');
            batch.set(doc(db, 'users', uid, 'activityLogs', id), {
              id,
              ownerId: uid,
              title: log.title,
              appOrDomain: log.appOrDomain,
              category: log.category,
              durationMinutes: Number(log.durationMinutes.toFixed(1)),
              actionTaken: log.actionTaken,
              aiReasoning: log.aiReasoning,
              deviceOs: log.deviceOs,
              createdAt: serverTimestamp(),
            });
          });

          await batch.commit();
        } else {
          // Register or heartbeat current device
          const devRef = doc(db, 'users', uid, 'devices', currentDev.id);
          const devSnap = await getDoc(devRef);
          if (!devSnap.exists()) {
            await setDoc(devRef, {
              id: currentDev.id,
              ownerId: uid,
              name: currentDev.name,
              os: currentDev.os,
              formFactor: currentDev.formFactor,
              enforcementActive: true,
              lastSeenAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            });
          } else {
            await updateDoc(devRef, {
              lastSeenAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      }

      // Attach real-time Firestore listeners
      unsubs.push(
        onSnapshot(
          userDocRef,
          (snap) => {
            if (!snap.exists()) return;
            const d = snap.data();
            setProfile({
              uid: d.uid,
              displayName: d.displayName,
              email: d.email,
              rewardBankMinutes: d.rewardBankMinutes ?? 0,
              shortFormMinutesToday: d.shortFormMinutesToday ?? 0,
              timeoutActiveUntil: d.timeoutActiveUntil ?? 0,
              leisurePassUntil: d.leisurePassUntil ?? 0,
              strictModeEnabled: Boolean(d.strictModeEnabled),
              focusEndsAt: d.focusEndsAt ?? 0,
              focusDurationMinutes: d.focusDurationMinutes ?? 25,
            });
          },
          (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'devices'),
          (snap) => {
            const list: SyncedDevice[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                ownerId: d.ownerId,
                name: d.name,
                os: d.os as OSPlatform,
                formFactor: d.formFactor,
                enforcementActive: Boolean(d.enforcementActive),
                lastSeenAtMs: d.lastSeenAt?.toMillis?.() ?? Date.now(),
              };
            });
            setDevices(list);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/devices`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'blocklist'),
          (snap) => {
            const list: BlockRule[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                ownerId: d.ownerId,
                target: d.target,
                pattern: d.pattern,
                category: d.category,
                mode: d.mode,
                enabled: Boolean(d.enabled),
                platforms: d.platforms || ['macOS', 'Windows', 'Linux', 'iOS', 'Android'],
              };
            });
            setBlocklist(list);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/blocklist`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'schedules'),
          (snap) => {
            const list: DowntimeSchedule[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                ownerId: d.ownerId,
                name: d.name,
                scheduleType: d.scheduleType,
                startTime: d.startTime,
                endTime: d.endTime,
                days: d.days || [],
                lockGames: Boolean(d.lockGames),
                lockSocialAndShorts: Boolean(d.lockSocialAndShorts),
                enabled: Boolean(d.enabled),
              };
            });
            setSchedules(list);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/schedules`)
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'activityLogs'), orderBy('createdAt', 'desc')),
          (snap) => {
            const list: ActivityLog[] = snap.docs.slice(0, 30).map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                ownerId: d.ownerId,
                title: d.title,
                appOrDomain: d.appOrDomain,
                category: d.category,
                durationMinutes: d.durationMinutes ?? 0,
                actionTaken: d.actionTaken,
                aiReasoning: d.aiReasoning,
                deviceOs: d.deviceOs,
                createdAtMs: d.createdAt?.toMillis?.() ?? Date.now(),
              };
            });
            setActivityLogs(list);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/activityLogs`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', uid, 'dailyStats'),
          (snap) => {
            const list: DailyStat[] = snap.docs
              .map((docSnap) => {
                const d = docSnap.data();
                return {
                  dateKey: d.dateKey,
                  ownerId: d.ownerId,
                  educationalMinutes: d.educationalMinutes ?? 0,
                  productiveMinutes: d.productiveMinutes ?? 0,
                  socialShortsMinutes: d.socialShortsMinutes ?? 0,
                  gamingMinutes: d.gamingMinutes ?? 0,
                  timeoutsTriggered: d.timeoutsTriggered ?? 0,
                  focusSessionsCompleted: d.focusSessionsCompleted ?? 0,
                };
              })
              .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
            setDailyStats(list);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/dailyStats`)
        )
      );
    });

    return () => {
      unsubAuth();
      unsubs.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived schedule & lock state
  const effectiveDate = useMemo(() => {
    const base = new Date(nowMs);
    if (simulatedTimeHHMM) {
      const [h, m] = simulatedTimeHHMM.split(':').map(Number);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        base.setHours(h, m, 0, 0);
      }
    }
    return base;
  }, [nowMs, simulatedTimeHHMM]);

  const activeSchedules = useMemo(
    () => schedules.filter((s) => isScheduleActiveAt(s, effectiveDate)),
    [schedules, effectiveDate]
  );

  const isDowntimeActive = useMemo(
    () => activeSchedules.some((s) => s.scheduleType === 'downtime' && s.lockSocialAndShorts),
    [activeSchedules]
  );

  const isGamesAutoLocked = useMemo(
    () => activeSchedules.some((s) => s.lockGames),
    [activeSchedules]
  );

  const isTimeoutActive = profile.timeoutActiveUntil > nowMs;
  const isLeisurePassActive = profile.leisurePassUntil > nowMs;
  const isFocusActive = profile.focusEndsAt > nowMs;

  const isShortsAndSocialBlocked =
    (isTimeoutActive && !isLeisurePassActive) || isDowntimeActive || isFocusActive;

  // Profile persistence helper
  const patchProfile = useCallback(
    async (partial: Partial<UserProfileState>) => {
      setProfile((prev) => ({ ...prev, ...partial }));
      if (!authUser) return;
      const path = `users/${authUser.uid}`;
      try {
        const sanitized: Record<string, unknown> = { ...partial, updatedAt: serverTimestamp() };
        if (typeof sanitized.rewardBankMinutes === 'number') {
          sanitized.rewardBankMinutes = Math.round(sanitized.rewardBankMinutes);
        }
        if (typeof sanitized.timeoutActiveUntil === 'number') {
          sanitized.timeoutActiveUntil = Math.round(sanitized.timeoutActiveUntil);
        }
        if (typeof sanitized.leisurePassUntil === 'number') {
          sanitized.leisurePassUntil = Math.round(sanitized.leisurePassUntil);
        }
        if (typeof sanitized.focusEndsAt === 'number') {
          sanitized.focusEndsAt = Math.round(sanitized.focusEndsAt);
        }
        if (typeof sanitized.focusDurationMinutes === 'number') {
          sanitized.focusDurationMinutes = Math.round(sanitized.focusDurationMinutes);
        }
        if (typeof sanitized.shortFormMinutesToday === 'number') {
          sanitized.shortFormMinutesToday = Number(sanitized.shortFormMinutesToday.toFixed(2));
        }
        await updateDoc(doc(db, 'users', authUser.uid), sanitized);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [authUser]
  );

  const logActivity = useCallback(
    async (entry: {
      title: string;
      appOrDomain: string;
      category: ContentCategory;
      durationMinutes: number;
      actionTaken: ActionTaken;
      aiReasoning: string;
    }) => {
      const id = makeSafeId('log');
      const ownerId = authUser?.uid || 'local-user';
      const os = detectCurrentDevice().os;
      const newLog: ActivityLog = {
        id,
        ownerId,
        ...entry,
        deviceOs: os,
        createdAtMs: Date.now(),
      };
      setActivityLogs((prev) => [newLog, ...prev].slice(0, 30));

      if (authUser) {
        const path = `users/${authUser.uid}/activityLogs/${id}`;
        try {
          await setDoc(doc(db, 'users', authUser.uid, 'activityLogs', id), {
            id,
            ownerId: authUser.uid,
            title: entry.title.slice(0, 200),
            appOrDomain: entry.appOrDomain.slice(0, 120),
            category: entry.category,
            durationMinutes: Number(entry.durationMinutes.toFixed(2)),
            actionTaken: entry.actionTaken,
            aiReasoning: entry.aiReasoning.slice(0, 400),
            deviceOs: os,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [authUser]
  );

  const incrementTodayStat = useCallback(
    async (deltas: Partial<Omit<DailyStat, 'dateKey' | 'ownerId'>>) => {
      const dateKey = formatDateKey(new Date());
      const ownerId = authUser?.uid || 'local-user';
      let updatedStat: DailyStat | null = null;

      setDailyStats((prev) => {
        const existing = prev.find((s) => s.dateKey === dateKey);
        const base: DailyStat = existing || {
          dateKey,
          ownerId,
          educationalMinutes: 0,
          productiveMinutes: 0,
          socialShortsMinutes: 0,
          gamingMinutes: 0,
          timeoutsTriggered: 0,
          focusSessionsCompleted: 0,
        };
        updatedStat = {
          ...base,
          educationalMinutes: Number(
            (base.educationalMinutes + (deltas.educationalMinutes || 0)).toFixed(1)
          ),
          productiveMinutes: Number(
            (base.productiveMinutes + (deltas.productiveMinutes || 0)).toFixed(1)
          ),
          socialShortsMinutes: Number(
            (base.socialShortsMinutes + (deltas.socialShortsMinutes || 0)).toFixed(1)
          ),
          gamingMinutes: Number((base.gamingMinutes + (deltas.gamingMinutes || 0)).toFixed(1)),
          timeoutsTriggered: Math.round(base.timeoutsTriggered + (deltas.timeoutsTriggered || 0)),
          focusSessionsCompleted: Math.round(
            base.focusSessionsCompleted + (deltas.focusSessionsCompleted || 0)
          ),
        };
        if (existing) {
          return prev.map((s) => (s.dateKey === dateKey ? updatedStat! : s));
        }
        return [...prev, updatedStat!].slice(-7);
      });

      if (authUser && updatedStat) {
        const statRef = doc(db, 'users', authUser.uid, 'dailyStats', dateKey);
        const path = `users/${authUser.uid}/dailyStats/${dateKey}`;
        try {
          const snap = await getDoc(statRef);
          const payload = updatedStat as DailyStat;
          if (!snap.exists()) {
            await setDoc(statRef, {
              ...payload,
              ownerId: authUser.uid,
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(statRef, {
              educationalMinutes: payload.educationalMinutes,
              productiveMinutes: payload.productiveMinutes,
              socialShortsMinutes: payload.socialShortsMinutes,
              gamingMinutes: payload.gamingMinutes,
              timeoutsTriggered: payload.timeoutsTriggered,
              focusSessionsCompleted: payload.focusSessionsCompleted,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      }
    },
    [authUser]
  );

  // Trigger gentle refocus coach from backend Gemini API
  const triggerRefocusNudge = useCallback(
    async (activityTitle: string, minutesSpent: number, isTimeoutBlock: boolean) => {
      try {
        const res = await fetch('/api/refocus-coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentActivity: activityTitle,
            minutesSpent: Number(minutesSpent.toFixed(1)),
            triggerReason: isTimeoutBlock
              ? 'Exceeded 10-minute short-form distraction timeout'
              : 'Approaching 10-minute short-form distraction threshold',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setRefocusPrompt({
            headline:
              data.headline ||
              (isTimeoutBlock
                ? '10-Minute Productivity Timeout Active'
                : 'Gentle Refocus Check-In'),
            message:
              data.message ||
              'You have spent several minutes on short-form feeds. Pause and decide intentionally what deserves your attention next.',
            microStep: data.microStep || 'Start a 25-minute Focus Session to earn +10m reward time.',
            triggerReason: isTimeoutBlock
              ? '10-minute distracting reels/shorts limit reached'
              : 'Extended distracting feed activity detected',
            isTimeoutBlock,
          });
          return;
        }
      } catch {
        // Fall through to deterministic copy if offline
      }
      setRefocusPrompt({
        headline: isTimeoutBlock
          ? '10-Minute Productivity Timeout Triggered'
          : 'Gentle Refocus Check-In',
        message: isTimeoutBlock
          ? `You crossed 10 minutes on "${activityTitle}". Unproductive Shorts, Reels, and social feeds are now locked across your synced devices.`
          : `You have watched "${activityTitle}" for ${minutesSpent.toFixed(1)} minutes. Consider wrapping up and switching back to your study or work queue.`,
        microStep: 'Complete a 25-minute Focus Timer to earn +10m reward screen time.',
        triggerReason: isTimeoutBlock ? '10m timeout threshold' : 'Gentle distraction prompt',
        isTimeoutBlock,
      });
    },
    []
  );

  // Focus timer completion handler
  const completeFocusSession = useCallback(async () => {
    if (completingFocusRef.current) return;
    completingFocusRef.current = true;
    try {
      const mins = profile.focusDurationMinutes || 25;
      const rewardEarned = Math.max(2, Math.round(mins * 0.4));
      await patchProfile({
        focusEndsAt: 0,
        rewardBankMinutes: profile.rewardBankMinutes + rewardEarned,
      });
      await incrementTodayStat({
        productiveMinutes: mins,
        focusSessionsCompleted: 1,
      });
      await logActivity({
        title: `${mins}-minute Deep Focus Session Completed`,
        appOrDomain: 'Clearline Focus Timer',
        category: 'productive_work',
        durationMinutes: mins,
        actionTaken: 'focus_completed',
        aiReasoning: `Earned +${rewardEarned} minutes of screen-time reward balance upon completion.`,
      });
    } finally {
      completingFocusRef.current = false;
    }
  }, [
    incrementTodayStat,
    logActivity,
    patchProfile,
    profile.focusDurationMinutes,
    profile.rewardBankMinutes,
  ]);

  // Real-time 1-second clock + focus completion + active watch monitor tick
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNowMs(now);

      if (profile.focusEndsAt > 0 && now >= profile.focusEndsAt) {
        completeFocusSession();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [profile.focusEndsAt, completeFocusSession]);

  // Active watch session second-by-second enforcement
  useEffect(() => {
    if (!activeWatchSession || !activeWatchSession.isRunning) return;

    const timer = setInterval(() => {
      setActiveWatchSession((prev) => {
        if (!prev || !prev.isRunning) return prev;
        const nextElapsed = prev.elapsedSeconds + 1;
        return { ...prev, elapsedSeconds: nextElapsed };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeWatchSession?.isRunning]);

  // Evaluate watch session thresholds when elapsedSeconds ticks
  useEffect(() => {
    if (!activeWatchSession || !activeWatchSession.isRunning) return;
    if (activeWatchSession.elapsedSeconds === 0) return;

    // Every 15 seconds of watch time, accumulate 0.25m to today's stats
    if (activeWatchSession.elapsedSeconds % 15 === 0) {
      const deltaMin = 0.25;
      if (activeWatchSession.category === 'educational') {
        incrementTodayStat({ educationalMinutes: deltaMin });
      } else if (activeWatchSession.category === 'productive_work') {
        incrementTodayStat({ productiveMinutes: deltaMin });
      } else if (activeWatchSession.category === 'gaming') {
        incrementTodayStat({ gamingMinutes: deltaMin });
      } else {
        incrementTodayStat({ socialShortsMinutes: deltaMin });
        const nextShortForm = Number((profile.shortFormMinutesToday + deltaMin).toFixed(2));
        patchProfile({ shortFormMinutesToday: nextShortForm });

        if (nextShortForm >= 7 && !nudgedThisSessionRef.current && nextShortForm < 10) {
          nudgedThisSessionRef.current = true;
          triggerRefocusNudge(activeWatchSession.title, nextShortForm, false);
        }

        if (nextShortForm >= 10 && !timedOutThisSessionRef.current && !isLeisurePassActive) {
          timedOutThisSessionRef.current = true;
          setActiveWatchSession((s) => (s ? { ...s, isRunning: false } : null));
          const timeoutUntil = Date.now() + 60 * 60 * 1000;
          patchProfile({ timeoutActiveUntil: timeoutUntil });
          incrementTodayStat({ timeoutsTriggered: 1 });
          logActivity({
            title: activeWatchSession.title,
            appOrDomain: activeWatchSession.appOrDomain,
            category: activeWatchSession.category,
            durationMinutes: nextShortForm,
            actionTaken: 'timeout_blocked',
            aiReasoning:
              'Exceeded 10-minute short-form reels/shorts threshold. Productivity timeout activated across all synced devices.',
          });
          triggerRefocusNudge(activeWatchSession.title, nextShortForm, true);
        }
      }
    }
  }, [
    activeWatchSession,
    incrementTodayStat,
    isLeisurePassActive,
    logActivity,
    patchProfile,
    profile.shortFormMinutesToday,
    triggerRefocusNudge,
  ]);

  const advanceWatchMinutes = useCallback(
    async (minutes: number) => {
      if (!activeWatchSession) return;
      const nextElapsed = activeWatchSession.elapsedSeconds + Math.round(minutes * 60);
      setActiveWatchSession((prev) =>
        prev ? { ...prev, elapsedSeconds: nextElapsed } : null
      );

      if (activeWatchSession.category === 'educational') {
        await incrementTodayStat({ educationalMinutes: minutes });
        return;
      }
      if (activeWatchSession.category === 'productive_work') {
        await incrementTodayStat({ productiveMinutes: minutes });
        return;
      }
      if (activeWatchSession.category === 'gaming') {
        await incrementTodayStat({ gamingMinutes: minutes });
        if (nextElapsed / 60 >= 15 && !nudgedThisSessionRef.current) {
          nudgedThisSessionRef.current = true;
          await triggerRefocusNudge(activeWatchSession.title, nextElapsed / 60, false);
        }
        return;
      }

      // Short-form / social feed
      await incrementTodayStat({ socialShortsMinutes: minutes });
      const nextShortForm = Number((profile.shortFormMinutesToday + minutes).toFixed(2));
      await patchProfile({ shortFormMinutesToday: nextShortForm });

      if (nextShortForm >= 10 && !isLeisurePassActive) {
        timedOutThisSessionRef.current = true;
        setActiveWatchSession((s) => (s ? { ...s, isRunning: false } : null));
        const timeoutUntil = Date.now() + 60 * 60 * 1000;
        await patchProfile({ timeoutActiveUntil: timeoutUntil });
        await incrementTodayStat({ timeoutsTriggered: 1 });
        await logActivity({
          title: activeWatchSession.title,
          appOrDomain: activeWatchSession.appOrDomain,
          category: activeWatchSession.category,
          durationMinutes: nextShortForm,
          actionTaken: 'timeout_blocked',
          aiReasoning:
            'Watched distracting shorts/reels over 10 minutes. Productivity timeout blocked shorts, reels, and social feeds.',
        });
        await triggerRefocusNudge(activeWatchSession.title, nextShortForm, true);
      } else if (nextShortForm >= 6 && !nudgedThisSessionRef.current) {
        nudgedThisSessionRef.current = true;
        await logActivity({
          title: activeWatchSession.title,
          appOrDomain: activeWatchSession.appOrDomain,
          category: activeWatchSession.category,
          durationMinutes: minutes,
          actionTaken: 'gentle_nudge',
          aiReasoning: 'Approaching 10-minute distracting media threshold; gentle refocus prompt displayed.',
        });
        await triggerRefocusNudge(activeWatchSession.title, nextShortForm, false);
      }
    },
    [
      activeWatchSession,
      incrementTodayStat,
      isLeisurePassActive,
      logActivity,
      patchProfile,
      profile.shortFormMinutesToday,
      triggerRefocusNudge,
    ]
  );

  const startWatchSessionFromAnalysis = useCallback(
    async (title: string, appOrDomain: string, analysis: AIAnalysisResult) => {
      nudgedThisSessionRef.current = false;
      timedOutThisSessionRef.current = false;

      // Check immediate game lock during work/study hours or downtime
      if (analysis.category === 'gaming' && isGamesAutoLocked) {
        await logActivity({
          title,
          appOrDomain,
          category: 'gaming',
          durationMinutes: 0,
          actionTaken: 'work_hours_locked',
          aiReasoning:
            'Unproductive games are automatically locked during active working/study hours or downtime.',
        });
        setRefocusPrompt({
          headline: 'Game Locked During Work & Study Hours',
          message: `"${title}" was automatically blocked because your Work & Study Hours or Downtime schedule is currently active.`,
          microStep: 'Return to your active study module or start a Focus Timer.',
          triggerReason: 'Automatic work-hours game lock',
          isTimeoutBlock: true,
        });
        return;
      }

      // Check if short-form/social already timed out or in downtime
      if (
        (analysis.category === 'distracting_short_form' || analysis.category === 'social_feed') &&
        isShortsAndSocialBlocked
      ) {
        await logActivity({
          title,
          appOrDomain,
          category: analysis.category,
          durationMinutes: 0,
          actionTaken: 'timeout_blocked',
          aiReasoning: isDowntimeActive
            ? 'Blocked by active Scheduled Downtime period.'
            : isFocusActive
              ? 'Blocked during active Focus Session.'
              : 'Blocked by 10-minute Productivity Timeout.',
        });
        setRefocusPrompt({
          headline: 'Distracting Feed Blocked',
          message: `"${title}" is currently blocked across your devices. Educational content remains unlimitedly accessible.`,
          microStep: analysis.educationalAlternative || 'Switch to an educational lecture instead.',
          triggerReason: 'Active timeout or scheduled block',
          isTimeoutBlock: true,
        });
        return;
      }

      // Log initial allowance
      await logActivity({
        title,
        appOrDomain,
        category: analysis.category,
        durationMinutes: 0,
        actionTaken: analysis.isEducational ? 'allowed_unlimited' : 'gentle_nudge',
        aiReasoning: analysis.reasoning,
      });

      setActiveWatchSession({
        title,
        appOrDomain,
        category: analysis.category,
        elapsedSeconds: 0,
        isRunning: true,
        aiReasoning: analysis.reasoning,
        educationalAlternative: analysis.educationalAlternative,
      });
    },
    [isDowntimeActive, isFocusActive, isGamesAutoLocked, isShortsAndSocialBlocked, logActivity]
  );

  const toggleWatchSessionRunning = useCallback(() => {
    setActiveWatchSession((prev) => (prev ? { ...prev, isRunning: !prev.isRunning } : null));
  }, []);

  const stopWatchSession = useCallback(() => {
    setActiveWatchSession(null);
  }, []);

  const dismissRefocusPrompt = useCallback(() => {
    setRefocusPrompt(null);
  }, []);

  const signIn = useCallback(async () => {
    setSyncError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setSyncError(msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
  }, []);

  const toggleStrictMode = useCallback(async () => {
    await patchProfile({ strictModeEnabled: !profile.strictModeEnabled });
  }, [patchProfile, profile.strictModeEnabled]);

  const startFocusTimer = useCallback(
    async (durationMinutes: number) => {
      const endsAt = Date.now() + durationMinutes * 60 * 1000;
      await patchProfile({
        focusDurationMinutes: Math.round(durationMinutes),
        focusEndsAt: Math.round(endsAt),
      });
    },
    [patchProfile]
  );

  const cancelFocusTimer = useCallback(async () => {
    await patchProfile({ focusEndsAt: 0 });
  }, [patchProfile]);

  const completeFocusTimerNow = useCallback(async () => {
    await completeFocusSession();
  }, [completeFocusSession]);

  const redeemRewardMinutes = useCallback(
    async (minutes: number): Promise<boolean> => {
      if (profile.rewardBankMinutes < minutes) return false;
      if (isDowntimeActive || isFocusActive) return false;
      const passUntil = Date.now() + minutes * 60 * 1000;
      await patchProfile({
        rewardBankMinutes: profile.rewardBankMinutes - minutes,
        leisurePassUntil: passUntil,
        timeoutActiveUntil: 0,
      });
      return true;
    },
    [isDowntimeActive, isFocusActive, patchProfile, profile.rewardBankMinutes]
  );

  const resetShortFormTimeoutForDemo = useCallback(async () => {
    await patchProfile({
      shortFormMinutesToday: 0,
      timeoutActiveUntil: 0,
      leisurePassUntil: 0,
    });
  }, [patchProfile]);

  const addBlockRule = useCallback(
    async (rule: Omit<BlockRule, 'id' | 'ownerId'>) => {
      const id = makeSafeId('rule');
      const ownerId = authUser?.uid || 'local-user';
      const fullRule: BlockRule = { ...rule, id, ownerId };
      setBlocklist((prev) => [fullRule, ...prev]);

      if (authUser) {
        const path = `users/${authUser.uid}/blocklist/${id}`;
        try {
          await setDoc(doc(db, 'users', authUser.uid, 'blocklist', id), {
            ...fullRule,
            ownerId: authUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [authUser]
  );

  const toggleBlockRule = useCallback(
    async (ruleId: string) => {
      const target = blocklist.find((r) => r.id === ruleId);
      if (!target) return;
      const nextEnabled = !target.enabled;
      setBlocklist((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled: nextEnabled } : r)));

      if (authUser) {
        const path = `users/${authUser.uid}/blocklist/${ruleId}`;
        try {
          await updateDoc(doc(db, 'users', authUser.uid, 'blocklist', ruleId), {
            enabled: nextEnabled,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [authUser, blocklist]
  );

  const deleteBlockRule = useCallback(
    async (ruleId: string) => {
      setBlocklist((prev) => prev.filter((r) => r.id !== ruleId));
      if (authUser) {
        const path = `users/${authUser.uid}/blocklist/${ruleId}`;
        try {
          await deleteDoc(doc(db, 'users', authUser.uid, 'blocklist', ruleId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    },
    [authUser]
  );

  const addSchedule = useCallback(
    async (sched: Omit<DowntimeSchedule, 'id' | 'ownerId'>) => {
      const id = makeSafeId('sched');
      const ownerId = authUser?.uid || 'local-user';
      const fullSched: DowntimeSchedule = { ...sched, id, ownerId };
      setSchedules((prev) => [...prev, fullSched]);

      if (authUser) {
        const path = `users/${authUser.uid}/schedules/${id}`;
        try {
          await setDoc(doc(db, 'users', authUser.uid, 'schedules', id), {
            ...fullSched,
            ownerId: authUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [authUser]
  );

  const toggleSchedule = useCallback(
    async (scheduleId: string) => {
      const target = schedules.find((s) => s.id === scheduleId);
      if (!target) return;
      const nextEnabled = !target.enabled;
      setSchedules((prev) =>
        prev.map((s) => (s.id === scheduleId ? { ...s, enabled: nextEnabled } : s))
      );

      if (authUser) {
        const path = `users/${authUser.uid}/schedules/${scheduleId}`;
        try {
          await updateDoc(doc(db, 'users', authUser.uid, 'schedules', scheduleId), {
            enabled: nextEnabled,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [authUser, schedules]
  );

  const deleteSchedule = useCallback(
    async (scheduleId: string) => {
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      if (authUser) {
        const path = `users/${authUser.uid}/schedules/${scheduleId}`;
        try {
          await deleteDoc(doc(db, 'users', authUser.uid, 'schedules', scheduleId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    },
    [authUser]
  );

  // Derive live weekly app usage table combining base history + today's live logs
  const appUsage = useMemo<AppUsageSummary[]>(() => {
    const todayStat = dailyStats[dailyStats.length - 1];
    const extraEdu = todayStat ? Math.max(0, todayStat.educationalMinutes - 64) : 0;
    const extraShorts = todayStat ? Math.max(0, todayStat.socialShortsMinutes - 4.5) : 0;
    const extraGames = todayStat ? todayStat.gamingMinutes : 0;

    return INITIAL_APP_USAGE_BASE.map((item) => {
      if (item.appName === 'YouTube (Lectures & Tutorials)') {
        return { ...item, minutesThisWeek: Math.round(item.minutesThisWeek + extraEdu) };
      }
      if (item.appName === 'YouTube Shorts') {
        return {
          ...item,
          minutesThisWeek: Math.round(item.minutesThisWeek + extraShorts),
          policyStatus: isShortsAndSocialBlocked ? '10m Cap / Timed Out' : 'Tracked',
        };
      }
      if (item.appName === 'Valorant & Steam') {
        return {
          ...item,
          minutesThisWeek: Math.round(item.minutesThisWeek + extraGames),
          policyStatus: isGamesAutoLocked ? 'Work-Hours Locked' : 'Tracked',
        };
      }
      return item;
    });
  }, [dailyStats, isGamesAutoLocked, isShortsAndSocialBlocked]);

  const value: ClearlineContextValue = {
    authUser,
    authReady,
    isCloudSynced: Boolean(authUser),
    syncError,
    profile,
    devices,
    blocklist,
    schedules,
    activityLogs,
    dailyStats,
    appUsage,
    nowMs,
    simulatedTimeHHMM,
    setSimulatedTimeHHMM,
    effectiveDate,
    activeSchedules,
    isGamesAutoLocked,
    isDowntimeActive,
    isTimeoutActive,
    isLeisurePassActive,
    isFocusActive,
    isShortsAndSocialBlocked,
    activeWatchSession,
    refocusPrompt,
    dismissRefocusPrompt,
    signIn,
    signOut,
    toggleStrictMode,
    startFocusTimer,
    cancelFocusTimer,
    completeFocusTimerNow,
    redeemRewardMinutes,
    addBlockRule,
    toggleBlockRule,
    deleteBlockRule,
    addSchedule,
    toggleSchedule,
    deleteSchedule,
    startWatchSessionFromAnalysis,
    toggleWatchSessionRunning,
    advanceWatchMinutes,
    stopWatchSession,
    resetShortFormTimeoutForDemo,
  };

  return <ClearlineContext.Provider value={value}>{children}</ClearlineContext.Provider>;
};

export function useClearline() {
  const ctx = useContext(ClearlineContext);
  if (!ctx) throw new Error('useClearline must be used within ClearlineProvider');
  return ctx;
}
