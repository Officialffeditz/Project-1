import {
  ActivityLog,
  AppUsageSummary,
  BlockRule,
  DailyStat,
  DeviceFormFactor,
  DowntimeSchedule,
  OSPlatform,
  SyncedDevice,
  UserProfileState,
} from '../types';

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getLast7DateKeys(baseDate = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    keys.push(formatDateKey(d));
  }
  return keys;
}

export function detectCurrentDevice(): {
  id: string;
  name: string;
  os: OSPlatform;
  formFactor: DeviceFormFactor;
} {
  if (typeof navigator === 'undefined') {
    return { id: 'web-desktop-01', name: 'Workstation Browser', os: 'Linux', formFactor: 'desktop' };
  }
  const ua = navigator.userAgent.toLowerCase();
  let os: OSPlatform = 'Linux';
  let formFactor: DeviceFormFactor = 'desktop';

  if (/iphone|ipod/.test(ua)) {
    os = 'iOS';
    formFactor = 'mobile';
  } else if (/ipad/.test(ua)) {
    os = 'iOS';
    formFactor = 'tablet';
  } else if (/android/.test(ua)) {
    os = 'Android';
    formFactor = /mobile/.test(ua) ? 'mobile' : 'tablet';
  } else if (/mac os|macintosh/.test(ua)) {
    os = 'macOS';
    formFactor = 'desktop';
  } else if (/windows/.test(ua)) {
    os = 'Windows';
    formFactor = 'desktop';
  }

  return {
    id: `this-${os.toLowerCase()}-${formFactor}`,
    name: `This ${os} ${formFactor === 'desktop' ? 'Workstation' : 'Device'}`,
    os,
    formFactor,
  };
}

export function getDayShortName(date: Date): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
}

export function parseHHMMToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isScheduleActiveAt(schedule: DowntimeSchedule, date: Date): boolean {
  if (!schedule.enabled) return false;
  const dayName = getDayShortName(date);
  const start = parseHHMMToMinutes(schedule.startTime);
  const end = parseHHMMToMinutes(schedule.endTime);
  const nowMin = date.getHours() * 60 + date.getMinutes();

  if (start <= end) {
    return schedule.days.includes(dayName) && nowMin >= start && nowMin < end;
  }
  // Overnight schedule (e.g. 22:00 -> 07:00)
  const yesterday = new Date(date);
  yesterday.setDate(date.getDate() - 1);
  const yesterdayName = getDayShortName(yesterday);
  if (nowMin >= start && schedule.days.includes(dayName)) return true;
  if (nowMin < end && schedule.days.includes(yesterdayName)) return true;
  return false;
}

export function createInitialProfile(uid = 'local-user'): UserProfileState {
  return {
    uid,
    displayName: 'Local Workspace',
    email: 'local@clearline.app',
    rewardBankMinutes: 20,
    shortFormMinutesToday: 4.5,
    timeoutActiveUntil: 0,
    leisurePassUntil: 0,
    strictModeEnabled: true,
    focusEndsAt: 0,
    focusDurationMinutes: 25,
  };
}

export function createInitialDevices(ownerId = 'local-user'): SyncedDevice[] {
  const current = detectCurrentDevice();
  const now = Date.now();
  return [
    {
      id: current.id,
      ownerId,
      name: current.name,
      os: current.os,
      formFactor: current.formFactor,
      enforcementActive: true,
      lastSeenAtMs: now,
    },
    {
      id: 'iphone-companion',
      ownerId,
      name: 'Personal iPhone',
      os: 'iOS',
      formFactor: 'mobile',
      enforcementActive: true,
      lastSeenAtMs: now - 1000 * 60 * 3,
    },
    {
      id: 'windows-gaming-rig',
      ownerId,
      name: 'Home Windows PC',
      os: 'Windows',
      formFactor: 'desktop',
      enforcementActive: true,
      lastSeenAtMs: now - 1000 * 60 * 14,
    },
    {
      id: 'android-tablet',
      ownerId,
      name: 'Study Tablet',
      os: 'Android',
      formFactor: 'tablet',
      enforcementActive: true,
      lastSeenAtMs: now - 1000 * 60 * 28,
    },
  ];
}

export function createInitialBlocklist(ownerId = 'local-user'): BlockRule[] {
  const allOS: OSPlatform[] = ['macOS', 'Windows', 'Linux', 'iOS', 'Android'];
  return [
    {
      id: 'rule-yt-shorts',
      ownerId,
      target: 'YouTube Shorts',
      pattern: 'youtube.com/shorts/*',
      category: 'short_form',
      mode: 'timeout_10m',
      enabled: true,
      platforms: allOS,
    },
    {
      id: 'rule-ig-reels',
      ownerId,
      target: 'Instagram Reels & Feed',
      pattern: 'instagram.com/reels/*',
      category: 'short_form',
      mode: 'timeout_10m',
      enabled: true,
      platforms: allOS,
    },
    {
      id: 'rule-tiktok',
      ownerId,
      target: 'TikTok For You Feed',
      pattern: 'tiktok.com',
      category: 'short_form',
      mode: 'strict_lock',
      enabled: true,
      platforms: allOS,
    },
    {
      id: 'rule-x-feed',
      ownerId,
      target: 'X / Twitter Timeline',
      pattern: 'x.com/home',
      category: 'social_feed',
      mode: 'timeout_10m',
      enabled: true,
      platforms: allOS,
    },
    {
      id: 'rule-reddit',
      ownerId,
      target: 'Reddit Popular Feed',
      pattern: 'reddit.com/r/popular',
      category: 'social_feed',
      mode: 'timeout_10m',
      enabled: true,
      platforms: ['macOS', 'Windows', 'Linux', 'iOS', 'Android'],
    },
    {
      id: 'rule-valorant',
      ownerId,
      target: 'Valorant & Riot Client',
      pattern: 'riotclient.exe / valorant',
      category: 'gaming',
      mode: 'work_hours_lock',
      enabled: true,
      platforms: ['Windows'],
    },
    {
      id: 'rule-steam',
      ownerId,
      target: 'Steam & Desktop Games',
      pattern: 'steampowered.com / steam',
      category: 'gaming',
      mode: 'work_hours_lock',
      enabled: true,
      platforms: ['macOS', 'Windows', 'Linux'],
    },
    {
      id: 'rule-mobile-games',
      ownerId,
      target: 'Brawl Stars / Clash Royale',
      pattern: 'com.supercell.*',
      category: 'gaming',
      mode: 'work_hours_lock',
      enabled: true,
      platforms: ['iOS', 'Android'],
    },
  ];
}

export function createInitialSchedules(ownerId = 'local-user'): DowntimeSchedule[] {
  return [
    {
      id: 'sched-work-study',
      ownerId,
      name: 'Deep Work & Study Hours',
      scheduleType: 'work_study',
      startTime: '09:00',
      endTime: '17:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      lockGames: true,
      lockSocialAndShorts: false,
      enabled: true,
    },
    {
      id: 'sched-evening-downtime',
      ownerId,
      name: 'Nightly Digital Downtime',
      scheduleType: 'downtime',
      startTime: '22:00',
      endTime: '07:00',
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      lockGames: true,
      lockSocialAndShorts: true,
      enabled: true,
    },
    {
      id: 'sched-weekend-study',
      ownerId,
      name: 'Weekend Coursework Block',
      scheduleType: 'work_study',
      startTime: '10:00',
      endTime: '13:30',
      days: ['Sat'],
      lockGames: true,
      lockSocialAndShorts: true,
      enabled: true,
    },
  ];
}

export function createInitialDailyStats(ownerId = 'local-user'): DailyStat[] {
  const keys = getLast7DateKeys();
  const sample = [
    { edu: 95, prod: 210, soc: 14, gam: 25, to: 1, foc: 2 },
    { edu: 110, prod: 245, soc: 10, gam: 0, to: 1, foc: 3 },
    { edu: 85, prod: 195, soc: 18, gam: 35, to: 2, foc: 2 },
    { edu: 130, prod: 260, soc: 8, gam: 0, to: 0, foc: 4 },
    { edu: 105, prod: 230, soc: 12, gam: 20, to: 1, foc: 3 },
    { edu: 140, prod: 140, soc: 9, gam: 45, to: 1, foc: 2 },
    { edu: 64, prod: 135, soc: 4.5, gam: 0, to: 0, foc: 1 },
  ];
  return keys.map((dateKey, idx) => ({
    dateKey,
    ownerId,
    educationalMinutes: sample[idx].edu,
    productiveMinutes: sample[idx].prod,
    socialShortsMinutes: sample[idx].soc,
    gamingMinutes: sample[idx].gam,
    timeoutsTriggered: sample[idx].to,
    focusSessionsCompleted: sample[idx].foc,
  }));
}

export function createInitialActivityLogs(ownerId = 'local-user'): ActivityLog[] {
  const now = Date.now();
  return [
    {
      id: 'log-init-1',
      ownerId,
      title: 'MIT 6.006 — Dynamic Programming & Memoization Lecture',
      appOrDomain: 'youtube.com/watch',
      category: 'educational',
      durationMinutes: 42,
      actionTaken: 'allowed_unlimited',
      aiReasoning: 'University computer science lecture; unlimited educational access granted.',
      deviceOs: 'macOS',
      createdAtMs: now - 1000 * 60 * 95,
    },
    {
      id: 'log-init-2',
      ownerId,
      title: '3Blue1Brown — Linear Transformations Visualized',
      appOrDomain: 'youtube.com/watch',
      category: 'educational',
      durationMinutes: 22,
      actionTaken: 'allowed_unlimited',
      aiReasoning: 'Mathematics visual instruction; unlimited watch time permitted.',
      deviceOs: 'iOS',
      createdAtMs: now - 1000 * 60 * 60,
    },
    {
      id: 'log-init-3',
      ownerId,
      title: 'Endless Street Food & Comedy Shorts',
      appOrDomain: 'youtube.com/shorts',
      category: 'distracting_short_form',
      durationMinutes: 4.5,
      actionTaken: 'gentle_nudge',
      aiReasoning: 'Short-form entertainment clips counted toward 10-minute daily budget.',
      deviceOs: 'iOS',
      createdAtMs: now - 1000 * 60 * 22,
    },
    {
      id: 'log-init-4',
      ownerId,
      title: 'Valorant Client Launch Attempt',
      appOrDomain: 'valorant.exe',
      category: 'gaming',
      durationMinutes: 0,
      actionTaken: 'work_hours_locked',
      aiReasoning: 'Automatically locked during Deep Work & Study Hours (09:00–17:00).',
      deviceOs: 'Windows',
      createdAtMs: now - 1000 * 60 * 14,
    },
  ];
}

export const INITIAL_APP_USAGE_BASE: AppUsageSummary[] = [
  {
    appName: 'VS Code & Docs',
    domainOrPackage: 'code.visualstudio.com',
    category: 'productive_work',
    minutesThisWeek: 840,
    platforms: ['macOS', 'Windows', 'Linux'],
    policyStatus: 'Tracked',
  },
  {
    appName: 'YouTube (Lectures & Tutorials)',
    domainOrPackage: 'youtube.com/watch',
    category: 'educational',
    minutesThisWeek: 595,
    platforms: ['macOS', 'Windows', 'iOS', 'Android'],
    policyStatus: 'Unlimited',
  },
  {
    appName: 'Coursera / Khan Academy',
    domainOrPackage: 'coursera.org',
    category: 'educational',
    minutesThisWeek: 215,
    platforms: ['macOS', 'iOS', 'Android'],
    policyStatus: 'Unlimited',
  },
  {
    appName: 'Valorant & Steam',
    domainOrPackage: 'riotclient / steam',
    category: 'gaming',
    minutesThisWeek: 125,
    platforms: ['Windows'],
    policyStatus: 'Work-Hours Locked',
  },
  {
    appName: 'YouTube Shorts',
    domainOrPackage: 'youtube.com/shorts',
    category: 'distracting_short_form',
    minutesThisWeek: 42,
    platforms: ['iOS', 'Android', 'macOS'],
    policyStatus: '10m Cap / Timed Out',
  },
  {
    appName: 'Instagram Reels',
    domainOrPackage: 'instagram.com/reels',
    category: 'distracting_short_form',
    minutesThisWeek: 26,
    platforms: ['iOS', 'Android'],
    policyStatus: '10m Cap / Timed Out',
  },
  {
    appName: 'Reddit / X Feeds',
    domainOrPackage: 'reddit.com · x.com',
    category: 'social_feed',
    minutesThisWeek: 18,
    platforms: ['macOS', 'iOS'],
    policyStatus: '10m Cap / Timed Out',
  },
];
