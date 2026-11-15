import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Loader2, Upload } from "lucide-react";

import { Field, fieldClass } from "@/components/auth/AuthPanel";
import { BotFlagList, ScanChips } from "@/components/videos/BotFlags";
import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { useProfile } from "@/hooks/use-auth";
import { useNow } from "@/hooks/use-earn";
import { refreshVideos, useMySubmissions } from "@/hooks/use-videos";
import {
  AGREEMENT_TEXT,
  PLATFORM_LABEL,
  parseVideoUrl,
  submitCooldown,
  type BotFlag,
  type Platform,
  type RiskLevel,
  type ScanStatus,
  type VideoFormat,
} from "@/lib/creator-videos";
import { formatCountdown } from "@/lib/earning";
import { submitCreatorVideo } from "@/lib/videos.functions";
import { cn } from "@/lib/utils";

type Result = { flags: BotFlag[]; scanStatus: ScanStatus; riskLevel: RiskLevel };

export function SubmitVideoCard() {
  const { data: profile } = useProfile();
  const mine = useMySubmissions();
  const now = useNow();
  const queryClient = useQueryClient();
  const submit = useServerFn(submitCreatorVideo);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<VideoFormat | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"url" | "title" | "format" | "agreed", string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const platform = profile?.creator_platform as Platform | null | undefined;
  const handle = profile?.creator_handle;
  const cooldown = submitCooldown(mine.data?.[0]?.created_at ?? null, now || Date.now());

  if (!profile) return <VaultCard className="h-40 skeleton-shimmer" />;

  if (!platform || !handle) {
    return (
      <VaultCard accent="cyan" className="animate-rise p-4">
        <div className="flex items-center gap-3">
          <IconTile tone="cyan">
            <Upload />
          </IconTile>
          <div>
            <h2 className="font-display font-semibold">Submit your videos</h2>
            <p className="text-xs text-muted-foreground">Link your YouTube or TikTok handle first. You earn every time someone watches.</p>
          </div>
        </div>
        <Button asChild variant="cyan" size="tactile-sm" className="mt-4 w-full">
          <Link to="/profile">Link my channel</Link>
        </Button>
      </VaultCard>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const next: typeof errors = {};
    const parsed = parseVideoUrl(url);
    if (!parsed) next.url = "Paste a full YouTube or TikTok video link.";
    else if (parsed.platform !== platform) next.url = `Your linked channel is on ${PLATFORM_LABEL[platform]}.`;
    if (title.trim().length < 3) next.title = "Title needs at least 3 characters.";
    if (title.trim().length > 120) next.title = "Keep the title under 120 characters.";
    if (!format) next.format = "Choose Short or Full video.";
    if (!agreed) next.agreed = "You must accept the creator agreement.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const res = await submit({ data: { url: url.trim(), title: title.trim(), format: format!, agreed: true } });
      setResult(res);
      setUrl("");
      setTitle("");
      setFormat(null);
      setAgreed(false);
      refreshVideos(queryClient);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't submit. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <VaultCard accent="cyan" className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <IconTile tone="cyan">
          <Upload />
        </IconTile>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-semibold">Submit a video</h2>
          <p className="truncate text-xs text-muted-foreground">
            1 video every 24 hours from <span className="font-mono text-foreground">@{handle}</span>
          </p>
        </div>
        <Chip tone="cyan">{PLATFORM_LABEL[platform]}</Chip>
      </div>

      {result ? (
        <div className="vault-well mt-4 space-y-2 p-3">
          <p className="text-sm font-semibold">Submitted. It stays pending until the admin reviews it.</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="gold">Pending</Chip>
            <ScanChips scan={result.scanStatus} risk={result.riskLevel} />
          </div>
          <BotFlagList flags={result.flags} />
        </div>
      ) : null}

      {!cooldown.canSubmit ? (
        <div className="vault-well mt-4 flex items-center gap-2.5 p-3">
          <Clock className="size-4 shrink-0 text-gold" />
          <p className="text-xs text-muted-foreground">
            Next submission opens in{" "}
            <span className="font-mono text-foreground">
              {cooldown.nextAt && now ? formatCountdown(cooldown.nextAt - now) : "…"}
            </span>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3.5">
          <Field label={`${PLATFORM_LABEL[platform]} video link`} htmlFor="vid-url" error={errors.url}>
            <input
              id="vid-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={platform === "youtube" ? "https://youtube.com/shorts/…" : "https://tiktok.com/@name/video/…"}
              className={cn(fieldClass, "font-mono text-xs")}
              aria-invalid={!!errors.url}
            />
          </Field>
          <Field label="Title" htmlFor="vid-title" error={errors.title}>
            <input
              id="vid-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your video called?"
              className={fieldClass}
              aria-invalid={!!errors.title}
            />
          </Field>
          <div>
            <p className="mb-1.5 font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Format
            </p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Format">
              {(
                [
                  ["short", "Short", "Under 1 min"],
                  ["full", "Full video", "1 min or longer"],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={format === value}
                  onClick={() => setFormat(value)}
                  className="vault-well cursor-pointer p-3 text-left ring-cyan/60 transition-shadow aria-checked:ring-2"
                >
                  <span className="block font-display text-sm font-semibold">{label}</span>
                  <span className="text-[0.7rem] text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
            {errors.format ? <p className="mt-1 text-xs text-destructive">{errors.format}</p> : null}
          </div>
          <div>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-emerald"
              />
              <span>{AGREEMENT_TEXT}</span>
            </label>
            {errors.agreed ? <p className="mt-1 text-xs text-destructive">{errors.agreed}</p> : null}
          </div>
          {formError ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive ring-1 ring-destructive/25">
              {formError}
            </p>
          ) : null}
          <Button type="submit" variant="cyan" size="tactile" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />} {busy ? "Review bot scanning…" : "Submit for review"}
          </Button>
        </form>
      )}
    </VaultCard>
  );
}
