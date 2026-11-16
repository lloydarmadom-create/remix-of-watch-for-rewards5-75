import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  REWARDS,
  checkGamepass,
  normalizeRobloxUsername,
  parseGamepassId,
  precheckRedemption,
  validateLightningDestination,
  type Reward,
} from "@/lib/payouts";

/** Which of the 5 progress steps failed: 2 account & cooldown, 3 verification, 4 deducting. */
export type RedeemResult =
  | { ok: true; payoutId: string }
  | { ok: false; stage: 2 | 3 | 4; error: string };

/** Step 2: account, maintenance, cooldown, coins and stock, read as the signed-in player. */
async function precheck(supabase: SupabaseClient<Database>, userId: string, reward: Reward) {
  const [profile, settings, payouts] = await Promise.all([
    supabase.from("profiles").select("coin_balance, is_banned, roblox_user_id").eq("id", userId).maybeSingle(),
    supabase.from("app_settings").select("maintenance_mode, testing_mode").eq("id", 1).maybeSingle(),
    supabase
      .from("payout_requests")
      .select("category, status, created_at")
      .eq("user_id", userId)
      .eq("category", reward.category)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (profile.error || !profile.data || settings.error || !settings.data || payouts.error) {
    return { error: "We couldn't load your account. Please try again.", robloxUserId: null };
  }
  const p = profile.data as { coin_balance: number; is_banned: boolean; roblox_user_id: number | null };
  const s = settings.data as { maintenance_mode: boolean; testing_mode: boolean };
  const error = precheckRedemption({
    reward,
    coinBalance: Number(p.coin_balance),
    isBanned: p.is_banned,
    maintenance: s.maintenance_mode,
    testingMode: s.testing_mode,
    stock: Number.POSITIVE_INFINITY, // players can't read stock; redeem_reward checks it
    payouts: payouts.data ?? [],
    now: Date.now(),
    robloxUserId: p.roblox_user_id,
  });
  return { error, robloxUserId: p.roblox_user_id };
}

/** Database errors from redeem_reward, mapped to the step that failed. */
function dbFailure(message: string): RedeemResult {
  const accountStep = /cooldown|suspended|maintenance|verify your roblox/i.test(message);
  return { ok: false, stage: accountStep ? 2 : 4, error: message };
}

/** Step 1 of Robux payouts: verify a Roblox username live and lock it to the profile. */
export const verifyRobloxUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ username: z.string().max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    const username = normalizeRobloxUsername(data.username);
    if (!username) return { ok: false as const, error: "Roblox usernames are 3–20 letters, numbers or underscores." };

    const { lookupRobloxUser } = await import("@/lib/payouts.server");
    let user;
    try {
      user = await lookupRobloxUser(username);
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Roblox didn't answer. Try again." };
    }
    if (!user) return { ok: false as const, error: `No Roblox account is called “${username}”. Check the spelling.` };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: status, error } = await supabaseAdmin.rpc("lock_roblox_identity", {
      p_user: context.userId,
      p_username: user.name,
      p_roblox_id: user.id,
      p_display: user.displayName,
      p_avatar: user.avatarUrl ?? "",
    });
    if (error) return { ok: false as const, error: error.message };
    return {
      ok: true as const,
      status: String(status) as "locked" | "unchanged" | "change_requested",
      username: user.name,
      displayName: user.displayName,
      robloxId: user.id,
      avatarUrl: user.avatarUrl,
    };
  });

/** Robux payout: live Gamepass check (exists, owned by the locked account, on sale at the exact price), then queue. */
export const redeemRobux = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reward: z.enum(["robux_5", "robux_10"]), gamepass: z.string().max(300) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<RedeemResult> => {
    const reward = REWARDS[data.reward];
    const pre = await precheck(context.supabase, context.userId, reward);
    if (pre.error || !pre.robloxUserId) return { ok: false, stage: 2, error: pre.error ?? "Verify your Roblox username first" };

    const gamepassId = parseGamepassId(data.gamepass);
    if (!gamepassId) return { ok: false, stage: 3, error: "Paste your Gamepass link (roblox.com/game-pass/…) or its number ID." };

    const { lookupGamepass } = await import("@/lib/payouts.server");
    let info;
    try {
      info = await lookupGamepass(gamepassId);
    } catch (err) {
      return { ok: false, stage: 3, error: err instanceof Error ? err.message : "Roblox didn't answer. Try again." };
    }
    const problem = checkGamepass(info, pre.robloxUserId, reward.gamepassPrice!);
    if (problem || !info) return { ok: false, stage: 3, error: problem ?? "We couldn't verify that Gamepass." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("redeem_reward", {
      p_user: context.userId,
      p_reward: reward.id,
      p_destination: `gamepass:${info.id}`,
      p_roblox_user_id: pre.robloxUserId,
      p_gamepass_id: info.id,
      p_gamepass_name: info.name,
      p_gamepass_price: info.price ?? 0,
    });
    if (error) return dbFailure(error.message);
    return { ok: true, payoutId: String(id) };
  });

/** Sats payout to a Lightning Address (checked live), LNURL, or lnbc… invoice. */
export const redeemSats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ destination: z.string().max(2000) }).parse(input))
  .handler(async ({ data, context }): Promise<RedeemResult> => {
    const reward = REWARDS.sats_20;
    const pre = await precheck(context.supabase, context.userId, reward);
    if (pre.error) return { ok: false, stage: 2, error: pre.error };

    const check = validateLightningDestination(data.destination, reward.payout);
    if (!check.ok) return { ok: false, stage: 3, error: check.error };
    if (check.kind === "address") {
      const { verifyLightningAddress } = await import("@/lib/payouts.server");
      const problem = await verifyLightningAddress(check.value, reward.payout);
      if (problem) return { ok: false, stage: 3, error: problem };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("redeem_reward", {
      p_user: context.userId,
      p_reward: reward.id,
      p_destination: check.value,
    });
    if (error) return dbFailure(error.message);
    return { ok: true, payoutId: String(id) };
  });
