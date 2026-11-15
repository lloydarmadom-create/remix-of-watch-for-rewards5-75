// Earning rules shown in the app. The database functions enforce the same numbers;
// keep both in step when a rule changes.
export const COINS_PER_AD = 1;
export const AD_SECONDS = 15;
export const AD_LIMIT = 60;
export const AD_WINDOW_HOURS = 11;
export const COINS_PER_LEVEL = 15;
export const MAX_LEVEL = 100;
export const COIN_CAP = 1500;
export const STREAK_GAP_HOURS = 24;
export const STREAK_RESET_HOURS = 48;
export const REFERRAL_ADS = 20;
export const REFERRAL_COINS = 1;

const HOUR = 3_600_000;

export function formatCoins(n: number | string | null | undefined) {
  return Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Level from lifetime coins earned: +1 per 15 coins, max 100. */
export function levelProgress(lifetimeEarned: number) {
  const earned = Math.max(0, Number(lifetimeEarned) || 0);
  const level = Math.min(MAX_LEVEL, Math.floor(earned / COINS_PER_LEVEL));
  if (level >= MAX_LEVEL) return { level, intoLevel: COINS_PER_LEVEL, needed: COINS_PER_LEVEL, maxed: true };
  return { level, intoLevel: earned - level * COINS_PER_LEVEL, needed: COINS_PER_LEVEL, maxed: false };
}

export function atCoinCap(balance: number) {
  return Number(balance) >= COIN_CAP;
}

/** Coins paid for a given streak day: days 3 and 7 of each week pay 5, others pay 1. */
export function streakReward(streakDay: number) {
  const cycleDay = ((Math.max(1, streakDay) - 1) % 7) + 1;
  return cycleDay === 3 || cycleDay === 7 ? 5 : 1;
}

/** Where a player's check-in streak stands right now. */
export function streakState(streakCount: number, lastCheckInAt: string | null, now: number) {
  const last = lastCheckInAt ? new Date(lastCheckInAt).getTime() : null;
  const broken = last === null || now - last > STREAK_RESET_HOURS * HOUR;
  const current = broken ? 0 : streakCount;
  const readyAt = last === null ? now : last + STREAK_GAP_HOURS * HOUR;
  const canCheckIn = now >= readyAt;
  const nextDay = current + 1;
  return { current, nextDay, canCheckIn, readyAt, reward: streakReward(nextDay) };
}

/** Rolling 11-hour ad window: 60 ads max, next slot frees when the oldest one expires. */
export function adWindowState(adsInWindow: number, oldestInWindow: string | null, now: number) {
  const used = Math.min(AD_LIMIT, adsInWindow);
  const blocked = adsInWindow >= AD_LIMIT;
  const resetsAt =
    blocked && oldestInWindow ? new Date(oldestInWindow).getTime() + AD_WINDOW_HOURS * HOUR : null;
  return { used, remaining: AD_LIMIT - used, blocked: blocked && (resetsAt === null || resetsAt > now), resetsAt };
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Roblox keeps 30% of every Game Pass sale; creators receive 70%.
/** Robux the creator receives for a Game Pass price. */
export function robuxReceived(price: number) {
  return Math.floor((Math.max(0, Math.floor(price)) * 7) / 10);
}

/** Smallest Game Pass price that pays out at least the wanted Robux. */
export function gamepassPriceFor(wanted: number) {
  return Math.ceil((Math.max(0, Math.floor(wanted)) * 10) / 7);
}
