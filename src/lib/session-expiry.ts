const DAY_MS = 24 * 60 * 60 * 1000;
// 03:00 IST (UTC+5:30, India has no daylight saving) == 21:30 UTC of the previous calendar day.
const CUTOFF_UTC_HOUR = 21;
const CUTOFF_UTC_MINUTE = 30;

/** Timestamp (ms) of the most recent 03:00 IST at or before `now`. */
export function lastCutoffAt(now: number = Date.now()): number {
  const d = new Date(now);
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), CUTOFF_UTC_HOUR, CUTOFF_UTC_MINUTE, 0, 0);
  return today <= now ? today : today - DAY_MS;
}

/** Timestamp (ms) of the next 03:00 IST after `now`. */
export function nextCutoffAt(now: number = Date.now()): number {
  return lastCutoffAt(now) + DAY_MS;
}

/** True when the sign-in happened before the most recent 03:00 IST. Missing/invalid input => false (fail open). */
export function isSessionExpired(lastSignInAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!lastSignInAt) return false;
  const t = Date.parse(lastSignInAt);
  if (Number.isNaN(t)) return false;
  return t < lastCutoffAt(now);
}