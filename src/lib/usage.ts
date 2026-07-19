// Minimal freemium usage gate. Enforced client-side only for this pass -
// good enough to shape behavior and drive upgrades, not abuse-proof. If this
// product gets real traffic, move the counting into a server-side check
// (Firebase Admin SDK reading the user's doc) inside the /api functions.

export const FREE_CHAT_DAILY_LIMIT = 15;
export const GUEST_CHAT_DAILY_LIMIT = 5;

const GUEST_USAGE_KEY = "ygg_guest_chat_usage";

interface UsageRecord {
  date: string;
  count: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadGuestUsage(): UsageRecord {
  try {
    const raw = localStorage.getItem(GUEST_USAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore, fall through to a fresh record
  }
  return { date: todayKey(), count: 0 };
}

function saveGuestUsage(usage: UsageRecord) {
  try {
    localStorage.setItem(GUEST_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // best-effort only
  }
}

export function isElite(profile: any | null): boolean {
  return profile?.tier === "elite";
}

export interface ChatUsageStatus {
  limitReached: boolean;
  remaining: number;
  limit: number;
}

export function getChatUsageStatus(profile: any | null, isGuest: boolean): ChatUsageStatus {
  if (isElite(profile)) {
    return { limitReached: false, remaining: Infinity, limit: Infinity };
  }

  const limit = isGuest ? GUEST_CHAT_DAILY_LIMIT : FREE_CHAT_DAILY_LIMIT;
  const today = todayKey();
  const usage: UsageRecord = isGuest
    ? loadGuestUsage()
    : (profile?.usage?.date === today ? profile.usage : { date: today, count: 0 });
  const count = usage.date === today ? usage.count : 0;

  return { limitReached: count >= limit, remaining: Math.max(0, limit - count), limit };
}

export async function recordChatUsage(
  profile: any | null,
  isGuest: boolean,
  updateProfile: (data: any) => Promise<void>
) {
  const today = todayKey();

  if (isGuest) {
    const usage = loadGuestUsage();
    const count = usage.date === today ? usage.count + 1 : 1;
    saveGuestUsage({ date: today, count });
    return;
  }

  const currentUsage: UsageRecord = profile?.usage?.date === today ? profile.usage : { date: today, count: 0 };
  await updateProfile({ usage: { date: today, count: currentUsage.count + 1 } });
}
