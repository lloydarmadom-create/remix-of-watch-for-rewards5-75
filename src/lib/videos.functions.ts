import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  SUBMIT_GAP_HOURS,
  normalizeTitle,
  parseChannelInput,
  parseVideoUrl,
  scanSubmission,
  submitCooldown,
} from "@/lib/creator-videos";

const submissionSchema = z.object({
  url: z.string().trim().min(10).max(500),
  title: z.string().trim().min(3, "Title needs at least 3 characters").max(120, "Keep the title under 120 characters"),
  format: z.enum(["short", "full"]),
  agreed: z.literal(true, { errorMap: () => ({ message: "You must accept the creator agreement" }) }),
});

/** Submits a creator video. The review bot runs here, on the server, before the video is saved as pending. */
export const submitCreatorVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submissionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const parsed = parseVideoUrl(data.url);
    if (!parsed) {
      throw new Error("Paste a full YouTube or TikTok video link, like youtube.com/watch?v=… or tiktok.com/@name/video/…");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("creator_platform, creator_handle, is_banned")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !profile) throw new Error("We couldn't load your profile. Please try again.");
    if (profile.is_banned) throw new Error("This account is suspended");
    if (!profile.creator_handle || !profile.creator_platform) {
      throw new Error("Link your YouTube or TikTok handle in Profile first");
    }
    if (profile.creator_platform !== parsed.platform) {
      throw new Error(`Your linked channel is on ${profile.creator_platform === "youtube" ? "YouTube" : "TikTok"}. Submit a video from that channel.`);
    }

    const { data: last } = await supabase
      .from("creator_videos")
      .select("created_at")
      .eq("creator_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!submitCooldown(last?.created_at ?? null, Date.now()).canSubmit) {
      throw new Error(`You can submit 1 video every ${SUBMIT_GAP_HOURS} hours`);
    }

    const { fetchOEmbed } = await import("@/lib/videos.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const oembed = await fetchOEmbed(parsed);

    const [same, others] = await Promise.all([
      supabaseAdmin
        .from("creator_videos")
        .select("id, creator_id, title, canonical_url, platform, video_key")
        .eq("video_key", parsed.key)
        .order("created_at", { ascending: true })
        .limit(20),
      supabaseAdmin
        .from("creator_videos")
        .select("id, normalized_title, title, canonical_url, platform, video_key")
        .neq("creator_id", userId)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);
    if (same.error || others.error) {
      console.error("review bot lookup failed", same.error ?? others.error);
      throw new Error("The review bot couldn't run. Please try again in a minute.");
    }

    const scan = scanSubmission({
      userId,
      parsed,
      title: data.title,
      linkedHandle: profile.creator_handle,
      oembed,
      sameVideo: same.data ?? [],
      otherTitles: others.data ?? [],
    });

    const { data: id, error } = await supabaseAdmin.rpc("submit_creator_video", {
      p_user: userId,
      p_platform: parsed.platform,
      p_video_url: data.url,
      p_canonical_url: parsed.canonicalUrl,
      p_video_key: parsed.key,
      p_title: data.title,
      p_normalized_title: normalizeTitle(data.title),
      p_format: data.format,
      p_agreed: data.agreed,
      p_scan_status: scan.scanStatus,
      p_risk_level: scan.riskLevel,
      p_flags: scan.flags,
      p_source_title: oembed?.title ?? null,
      p_source_author: oembed?.authorName ?? null,
      p_source_author_url: oembed?.authorUrl ?? null,
      p_thumbnail_url: oembed?.thumbnailUrl ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { id: id as unknown as string, ...scan };
  });

/** Pays out a finished unlock. The viewer's network address is read here, never sent by the browser. */
export const claimVideoView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ unlockId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { clientIp } = await import("@/lib/videos.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("complete_video_view", {
      p_user: context.userId,
      p_unlock_id: data.unlockId,
      p_ip: clientIp() as string,
    });
    if (error) throw new Error(error.message);
    const r = (result ?? {}) as Record<string, unknown>;
    return {
      counted: r["counted"] === true,
      viewerReward: Number(r["viewer_reward"] ?? 0),
      creatorReward: Number(r["creator_reward"] ?? 0),
      reason: typeof r["reason"] === "string" ? r["reason"] : null,
    };
  });

/**
 * Videos this account, or anyone on the same network, unlocked in the last 24 hours,
 * with when each unlock runs out. Replays inside that window are free and earn nothing.
 */
export const getUnlockedVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { clientIp } = await import("@/lib/videos.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("unlocked_videos", {
      p_user: context.userId,
      p_ip: clientIp() as string,
    });
    if (error) throw new Error(error.message);
    return ((data ?? []) as { video_id: string; unlocked_until: string }[]).map((r) => ({
      videoId: String(r.video_id),
      until: String(r.unlocked_until),
    }));
  });

const channelSchema = z.object({ platform: z.enum(["youtube", "tiktok"]), input: z.string().max(300) });

/** Step 1 of linking a creator channel: check the link/handle and fetch the channel's public name. */
export const previewCreatorChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => channelSchema.parse(input))
  .handler(async ({ data }) => {
    const parsed = parseChannelInput(data.platform, data.input);
    if (!parsed.ok) return { ok: false as const, error: parsed.error };
    const { fetchChannelInfo } = await import("@/lib/videos.server");
    const info = await fetchChannelInfo(data.platform, parsed.handle);
    if (info.status === "not_found") {
      return { ok: false as const, error: `We couldn't find @${parsed.handle} on ${data.platform === "youtube" ? "YouTube" : "TikTok"}. Check the spelling.` };
    }
    return {
      ok: true as const,
      handle: parsed.handle,
      found: info.status === "found",
      name: info.status === "found" ? info.name : null,
      avatarUrl: info.status === "found" ? info.avatarUrl : null,
      url: info.url,
    };
  });

/** Step 2: the player confirmed "Is this your channel?". Locks it to their profile. */
export const linkCreatorChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => channelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const parsed = parseChannelInput(data.platform, data.input);
    if (!parsed.ok) return { ok: false as const, error: parsed.error };
    const { error } = await context.supabase
      .from("profiles")
      .update({ creator_platform: data.platform, creator_handle: parsed.handle })
      .eq("id", context.userId);
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "That channel is already linked to another account." };
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, handle: parsed.handle };
  });
