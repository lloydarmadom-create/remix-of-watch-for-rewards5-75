import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Clapperboard, ExternalLink, Loader2, Lock, UserRound } from "lucide-react";

import { Field, fieldClass } from "@/components/auth/AuthPanel";
import { openContactSupport } from "@/components/support/ContactSupport";
import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { useProfile } from "@/hooks/use-auth";
import { PLATFORM_LABEL, type Platform } from "@/lib/creator-videos";
import { linkCreatorChannel, previewCreatorChannel } from "@/lib/videos.functions";
import { cn } from "@/lib/utils";

type Preview = { handle: string; found: boolean; name: string | null; avatarUrl: string | null; url: string };

/** Link the one YouTube or TikTok channel this player submits videos from. Locked once confirmed. */
export function CreatorHandleCard() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const preview = useServerFn(previewCreatorChannel);
  const link = useServerFn(linkCreatorChannel);
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"preview" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Preview | null>(null);

  const linked = profile?.creator_handle && profile.creator_platform ? profile : null;

  const onCheck = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy("preview");
    try {
      const res = await preview({ data: { platform, input } });
      if (!res.ok) setError(res.error);
      else setFound(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check that channel. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const onConfirm = async () => {
    if (!found) return;
    setError(null);
    setBusy("link");
    try {
      const res = await link({ data: { platform, input: `@${found.handle}` } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFound(null);
      setInput("");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <VaultCard accent="cyan" className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <IconTile tone="cyan">
          <Clapperboard />
        </IconTile>
        <div className="flex-1">
          <h2 className="font-display font-semibold">Creator channel</h2>
          <p className="text-xs text-muted-foreground">Link your channel to submit videos in the Videos tab.</p>
        </div>
      </div>

      {linked ? (
        <>
          <div className="vault-well mt-4 flex items-center gap-2 px-3 py-2.5">
            <Chip tone="cyan">{PLATFORM_LABEL[linked.creator_platform as Platform]}</Chip>
            <span className="min-w-0 flex-1 truncate font-mono text-sm">@{linked.creator_handle}</span>
            <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Locked" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Your channel is locked to this account.{" "}
            <button type="button" onClick={openContactSupport} className="cursor-pointer text-cyan underline-offset-4 hover:underline">
              Contact support
            </button>{" "}
            to change it.
          </p>
          <Button asChild variant="slate" size="tactile-sm" className="mt-3 w-full">
            <Link to="/videos">Submit a video</Link>
          </Button>
        </>
      ) : found ? (
        <div className="mt-4 space-y-3" role="alertdialog" aria-labelledby="channel-confirm">
          <p id="channel-confirm" className="text-center font-display text-base font-semibold">
            Is this your channel?
          </p>
          <div className="vault-well flex items-center gap-3 p-3">
            {found.avatarUrl ? (
              <img src={found.avatarUrl} alt="" className="size-12 shrink-0 rounded-full object-cover ring-1 ring-border" />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-muted">
                <UserRound className="size-5 text-muted-foreground" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{found.name ?? `@${found.handle}`}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                @{found.handle} · {PLATFORM_LABEL[platform]}
              </p>
            </div>
            {found.found ? <BadgeCheck className="size-5 shrink-0 text-emerald" /> : null}
          </div>
          {!found.found ? (
            <p className="text-xs text-gold">
              {PLATFORM_LABEL[platform]} didn't share a preview right now. Open the link to make sure it's yours.
            </p>
          ) : null}
          <a
            href={found.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-cyan underline-offset-4 hover:underline"
          >
            Open channel <ExternalLink className="size-3" />
          </a>
          <p className="text-xs text-muted-foreground">Once confirmed, this channel is locked to your profile.</p>
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="slate" size="tactile-sm" disabled={busy !== null} onClick={() => setFound(null)}>
              No, go back
            </Button>
            <Button variant="cyan" size="tactile-sm" disabled={busy !== null} onClick={onConfirm}>
              {busy === "link" ? <Loader2 className="animate-spin" /> : <BadgeCheck />} Yes, lock it
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onCheck} noValidate className="mt-4 space-y-3">
          <div className="vault-well grid grid-cols-2 gap-1 p-1" role="radiogroup" aria-label="Platform">
            {(["youtube", "tiktok"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={platform === p}
                onClick={() => {
                  setPlatform(p);
                  setError(null);
                }}
                className="h-9 cursor-pointer rounded-lg font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors aria-checked:bg-vault-raised aria-checked:text-foreground aria-checked:shadow-press-slate"
              >
                {PLATFORM_LABEL[p]}
              </button>
            ))}
          </div>
          <Field label={`${PLATFORM_LABEL[platform]} channel link or @handle`} htmlFor="creator-handle" error={error ?? undefined}>
            <input
              id="creator-handle"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={platform === "youtube" ? "youtube.com/@yourchannel" : "tiktok.com/@yourname"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={cn(fieldClass, "font-mono")}
            />
          </Field>
          <Button type="submit" variant="cyan" size="tactile-sm" className="w-full" disabled={busy !== null || !input.trim()}>
            {busy === "preview" ? <Loader2 className="animate-spin" /> : null} Find my channel
          </Button>
        </form>
      )}
    </VaultCard>
  );
}
