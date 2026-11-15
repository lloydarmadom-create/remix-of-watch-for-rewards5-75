import type { GamepassInfo } from "@/lib/payouts";

const TIMEOUT = 8000;

async function getJson(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    ...init,
    headers: { accept: "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

const rec = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export type RobloxUser = { id: number; name: string; displayName: string; avatarUrl: string | null };

/** Looks up a Roblox account by exact username with Roblox's public Users and Thumbnails APIs. */
export async function lookupRobloxUser(username: string): Promise<RobloxUser | null> {
  const users = await getJson("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
  });
  if (users.status === 429) throw new Error("Roblox is busy right now. Try again in a minute.");
  if (users.status >= 400) throw new Error("Roblox didn't answer. Try again in a minute.");
  const first = rec((rec(users.body)["data"] as unknown[] | undefined)?.[0]);
  const id = Number(first["id"]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  let avatarUrl: string | null = null;
  try {
    const thumb = await getJson(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`,
    );
    const t = rec((rec(thumb.body)["data"] as unknown[] | undefined)?.[0]);
    if (t["state"] === "Completed" && typeof t["imageUrl"] === "string") avatarUrl = t["imageUrl"];
  } catch (err) {
    console.error("roblox thumbnail lookup failed", id, err);
  }

  return {
    id,
    name: String(first["name"] ?? username),
    displayName: String(first["displayName"] ?? first["name"] ?? username),
    avatarUrl,
  };
}

/** Gamepass owner, price and sale state from Roblox's public Game Passes API. Null when it doesn't exist. */
export async function lookupGamepass(id: number): Promise<GamepassInfo | null> {
  const r = await getJson(`https://apis.roblox.com/game-passes/v1/game-passes/${id}/product-info`);
  if (r.status === 404 || r.status === 400) return null;
  if (r.status === 429) throw new Error("Roblox is busy right now. Try again in a minute.");
  if (r.status >= 400) throw new Error("Roblox didn't answer. Try again in a minute.");
  const b = rec(r.body);
  if (!b["TargetId"] && !b["ProductId"]) return null;
  const creator = rec(b["Creator"]);
  const creatorId = Number(creator["CreatorTargetId"] ?? creator["Id"]);
  const price = b["PriceInRobux"];
  return {
    id,
    name: String(b["Name"] ?? `Gamepass ${id}`).slice(0, 120),
    creatorId: Number.isSafeInteger(creatorId) ? creatorId : null,
    creatorType: typeof creator["CreatorType"] === "string" ? creator["CreatorType"] : null,
    price: typeof price === "number" ? price : null,
    isForSale: b["IsForSale"] === true,
  };
}

/**
 * Checks a Lightning Address live through its wallet's LNURL-pay endpoint and that it
 * can receive the payout amount. Returns an error message, or null when it's good.
 */
export async function verifyLightningAddress(address: string, sats: number): Promise<string | null> {
  const [user, domain] = address.split("@");
  if (!user || !domain) return "That doesn't look like a Lightning Address.";
  let r: { status: number; body: unknown };
  try {
    r = await getJson(`https://${domain}/.well-known/lnurlp/${encodeURIComponent(user)}`);
  } catch (err) {
    console.error("lightning address lookup failed", domain, err);
    return `We couldn't reach ${domain}. Check the spelling of your Lightning Address.`;
  }
  const b = rec(r.body);
  if (r.status === 404 || b["status"] === "ERROR") {
    return `${address} wasn't found at ${domain}. Copy the address straight from your wallet.`;
  }
  if (r.status >= 400 || b["tag"] !== "payRequest") {
    return `${domain} didn't confirm this as a Lightning Address. Copy the address straight from your wallet.`;
  }
  const msat = sats * 1000;
  const min = Number(b["minSendable"] ?? 0);
  const max = Number(b["maxSendable"] ?? Number.MAX_SAFE_INTEGER);
  if (min > msat || max < msat) return `This wallet can't receive exactly ${sats} sats. Try another Lightning wallet.`;
  return null;
}
