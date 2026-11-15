// Store and payout rules shown in the app. The redeem_reward database function enforces
// the same costs, stock and cooldowns; keep both in step when a rule changes.

const HOUR = 3_600_000;

export type RewardId = "sats_20" | "robux_5" | "robux_10";
export type RewardCategory = "sats" | "robux";
export type PayoutStatus = "pending" | "paid" | "rejected";

export type Reward = {
  id: RewardId;
  category: RewardCategory;
  title: string;
  subtitle: string;
  coins: number;
  /** Units taken from the vault stock (Sats, or the Gamepass price in Robux). */
  stockCost: number;
  /** What the player receives. */
  payout: number;
  cooldownHours: number;
  /** Robux only: exact Gamepass price the player must put on sale. */
  gamepassPrice?: number;
};

export const REWARDS: Record<RewardId, Reward> = {
  sats_20: { id: "sats_20", category: "sats", title: "20 Sats", subtitle: "Bitcoin Lightning", coins: 120, stockCost: 20, payout: 20, cooldownHours: 24 },
  robux_5: { id: "robux_5", category: "robux", title: "5 Robux", subtitle: "Via your Gamepass", coins: 500, stockCost: 7, payout: 5, cooldownHours: 168, gamepassPrice: 7 },
  robux_10: { id: "robux_10", category: "robux", title: "10 Robux", subtitle: "Via your Gamepass", coins: 1000, stockCost: 15, payout: 10, cooldownHours: 168, gamepassPrice: 15 },
};

export const REWARD_LIST = [REWARDS.sats_20, REWARDS.robux_5, REWARDS.robux_10];

/** Reference size for the vault stock bars (the default starting stock). */
export const STOCK_CAPACITY: Record<RewardCategory, number> = { sats: 1000, robux: 500 };

export const STATUS_LABEL: Record<PayoutStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  rejected: "Rejected — Refunded",
};

type PayoutLike = { category: string; status: string; created_at: string };

/**
 * Cooldown for one category. Sats and Robux are tracked separately, rejected (refunded)
 * requests don't count, and testing mode skips cooldowns entirely.
 */
export function rewardCooldown(category: RewardCategory, payouts: PayoutLike[], now: number, testingMode: boolean) {
  const hours = category === "sats" ? REWARDS.sats_20.cooldownHours : REWARDS.robux_5.cooldownHours;
  if (testingMode) return { ready: true, readyAt: null as number | null, bypassed: true };
  const last = payouts
    .filter((p) => p.category === category && p.status !== "rejected")
    .reduce<number | null>((max, p) => {
      const t = new Date(p.created_at).getTime();
      return max === null || t > max ? t : max;
    }, null);
  const readyAt = last === null ? null : last + hours * HOUR;
  return { ready: readyAt === null || now >= readyAt, readyAt, bypassed: false };
}

/** Why a redemption can't start yet, checked before any Roblox or wallet lookup. Null when clear. */
export function precheckRedemption(input: {
  reward: Reward;
  coinBalance: number;
  isBanned: boolean;
  maintenance: boolean;
  testingMode: boolean;
  stock: number;
  payouts: PayoutLike[];
  now: number;
  robloxUserId?: number | null;
}): string | null {
  const { reward } = input;
  if (input.maintenance) return "Vault maintenance in progress";
  if (input.isBanned) return "This account is suspended";
  const cd = rewardCooldown(reward.category, input.payouts, input.now, input.testingMode);
  if (!cd.ready && cd.readyAt) {
    return `Your ${reward.category === "sats" ? "Sats" : "Robux"} cooldown ends in ${formatWait(cd.readyAt - input.now)}`;
  }
  if (Number(input.coinBalance) < reward.coins) return `Not enough coins: ${reward.title} needs ${reward.coins.toLocaleString("en-US")} coins`;
  if (input.stock < reward.stockCost) return `${reward.category === "sats" ? "Sats" : "Robux"} are out of stock right now. Check back soon`;
  if (reward.category === "robux" && !input.robloxUserId) return "Verify your Roblox username first";
  return null;
}

export function formatWait(ms: number) {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${m}m`;
}

// ---------- Bitcoin Lightning destinations ----------

export const BLOCKED_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
];

export const KNOWN_LIGHTNING_WALLETS: Record<string, string> = {
  "walletofsatoshi.com": "Wallet of Satoshi",
  "zbd.gg": "ZBD",
  "coinos.io": "Coinos",
  "blink.sv": "Blink",
  "speed.app": "Speed",
  "strike.me": "Strike",
  "getalby.com": "Alby",
};

export type LightningCheck =
  | { ok: true; kind: "address" | "lnurl" | "bolt11"; value: string; wallet: string | null }
  | { ok: false; error: string };

const BECH32 = "[02-9ac-hj-np-z]";
const ADDRESS_RE = /^[a-z0-9._+-]{1,64}@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})$/;
const LNURL_RE = new RegExp(`^lnurl1${BECH32}{40,}$`, "i");
const BOLT11_RE = new RegExp(`^lnbc(\\d*)([munp]?)1(${BECH32}{100,})$`, "i");

/** Sats in a BOLT11 invoice amount, or null when the invoice has no amount. */
function invoiceSats(digits: string, unit: string): number | null {
  if (!digits) return null;
  const n = Number(digits);
  const perUnit: Record<string, number> = { "": 1e8, m: 1e5, u: 100, n: 0.1, p: 0.0001 };
  return n * (perUnit[unit.toLowerCase()] ?? 1e8);
}

/** Validates a payout destination: a real Lightning Address, an LNURL, or a lnbc… invoice. */
export function validateLightningDestination(raw: string, sats = REWARDS.sats_20.payout): LightningCheck {
  const value = raw.trim().replace(/^lightning:/i, "");
  if (!value) return { ok: false, error: "Enter a Lightning Address, LNURL or lnbc… invoice." };
  if (value.length > 2000) return { ok: false, error: "That's too long to be a Lightning destination." };
  const lower = value.toLowerCase();

  if (lower.startsWith("lnurl")) {
    return LNURL_RE.test(value)
      ? { ok: true, kind: "lnurl", value, wallet: null }
      : { ok: false, error: "That LNURL looks incomplete. Copy the whole code from your wallet." };
  }

  if (/^ln(tb|tbs|bcrt)/.test(lower)) return { ok: false, error: "That's a test-network invoice. Use a real lnbc… invoice." };
  if (lower.startsWith("lnbc")) {
    const m = BOLT11_RE.exec(value);
    if (!m) return { ok: false, error: "That invoice looks incomplete. Copy the whole lnbc… code from your wallet." };
    const amount = invoiceSats(m[1] ?? "", m[2] ?? "");
    if (amount !== null && amount !== sats) {
      return { ok: false, error: `This invoice is for ${amount.toLocaleString("en-US")} sats. Create one for exactly ${sats} sats, or leave the amount empty.` };
    }
    return { ok: true, kind: "bolt11", value, wallet: null };
  }

  if (value.includes("@")) {
    const m = ADDRESS_RE.exec(lower);
    if (!m) return { ok: false, error: "That doesn't look like a Lightning Address. It should look like you@walletofsatoshi.com." };
    const domain = m[1]!;
    if (BLOCKED_EMAIL_DOMAINS.includes(domain)) {
      return { ok: false, error: `@${domain} is a regular email address, not a Lightning Address. Use the address from your Lightning wallet, like you@walletofsatoshi.com.` };
    }
    return { ok: true, kind: "address", value: lower, wallet: KNOWN_LIGHTNING_WALLETS[domain] ?? null };
  }

  return { ok: false, error: "Enter a Lightning Address (you@walletofsatoshi.com), an LNURL, or a lnbc… invoice." };
}

// ---------- Roblox ----------

/** Roblox usernames: 3–20 letters, numbers or underscores. */
export function normalizeRobloxUsername(raw: string): string | null {
  const v = raw.trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{3,20}$/.test(v) ? v : null;
}

/** Gamepass ID from a roblox.com/game-pass/… link or a bare number. */
export function parseGamepassId(raw: string): number | null {
  const v = raw.trim();
  const m = /^(\d{1,15})$/.exec(v) ?? /roblox\.com\/(?:[a-z-]+\/)?game-pass(?:es)?\/(\d{1,15})/i.exec(v);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export type GamepassInfo = {
  id: number;
  name: string;
  creatorId: number | null;
  creatorType: string | null;
  price: number | null;
  isForSale: boolean;
};

/** Why a Gamepass can't be used for this payout, or null when it's valid. */
export function checkGamepass(info: GamepassInfo | null, robloxUserId: number, requiredPrice: number): string | null {
  if (!info) return "We couldn't find that Gamepass on Roblox. Check the link or ID.";
  if (info.creatorType !== "User" || info.creatorId !== robloxUserId) {
    return "That Gamepass isn't owned by your verified Roblox account. Create it in one of your own experiences.";
  }
  if (!info.isForSale) return "That Gamepass isn't on sale. Turn on “Item for Sale” in the Creator Hub, then try again.";
  if (info.price !== requiredPrice) {
    return `That Gamepass costs ${info.price ?? "no"} Robux. Set the price to exactly ${requiredPrice} Robux, then try again.`;
  }
  return null;
}

export const gamepassUrl = (id: number | string) => `https://www.roblox.com/game-pass/${id}`;
