import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clapperboard, Loader2 } from "lucide-react";

import { Field, fieldClass } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_LABEL, normalizeHandle, type Platform } from "@/lib/creator-videos";
import { cn } from "@/lib/utils";

/** Link the one YouTube or TikTok channel this player submits videos from. */
export function CreatorHandleCard() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [handle, setHandle] = useState("");
  const [editing, setEditing] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const linked = profile?.creator_handle && profile.creator_platform ? profile : null;

  useEffect(() => {
    if (linked) {
      setPlatform(linked.creator_platform as Platform);
      setHandle(linked.creator_handle ?? "");
    }
  }, [linked?.creator_platform, linked?.creator_handle]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async (next: { creator_platform: Platform | null; creator_handle: string | null }) => {
      const { error } = await supabase.from("profiles").update(next).eq("id", user!.id);
      if (error) {
        if (error.code === "23505") throw new Error("That channel is already linked to another account.");
        throw error;
      }
    },
    onSuccess: () => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = normalizeHandle(handle);
    if (!clean) {
      setFieldError("Use 2–30 letters, numbers, dots, dashes or underscores.");
      return;
    }
    setFieldError(null);
    save.mutate({ creator_platform: platform, creator_handle: clean });
  };

  const showForm = !linked || editing;

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

      {!showForm && linked ? (
        <div className="mt-4 flex items-center gap-3">
          <div className="vault-well flex flex-1 items-center gap-2 px-3 py-2.5">
            <Chip tone="cyan">{PLATFORM_LABEL[linked.creator_platform as Platform]}</Chip>
            <span className="truncate font-mono text-sm">@{linked.creator_handle}</span>
          </div>
          <Button variant="slate" size="tactile-sm" onClick={() => setEditing(true)}>
            Change
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
          <div className="vault-well grid grid-cols-2 gap-1 p-1" role="radiogroup" aria-label="Platform">
            {(["youtube", "tiktok"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={platform === p}
                onClick={() => setPlatform(p)}
                className="h-9 cursor-pointer rounded-lg font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors aria-checked:bg-vault-raised aria-checked:text-foreground aria-checked:shadow-press-slate"
              >
                {PLATFORM_LABEL[p]}
              </button>
            ))}
          </div>
          <Field label={`${PLATFORM_LABEL[platform]} handle`} htmlFor="creator-handle" error={fieldError ?? undefined}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                @
              </span>
              <input
                id="creator-handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="yourchannel"
                autoCapitalize="none"
                autoCorrect="off"
                className={cn(fieldClass, "pl-8 font-mono")}
              />
            </div>
          </Field>
          {save.isError ? (
            <p role="alert" className="text-xs text-destructive">
              {save.error instanceof Error ? save.error.message : "Couldn't save. Please try again."}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" variant="cyan" size="tactile-sm" className="flex-1" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null} Save channel
            </Button>
            {linked ? (
              <Button type="button" variant="slate" size="tactile-sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
          {linked ? (
            <button
              type="button"
              onClick={() => save.mutate({ creator_platform: null, creator_handle: null })}
              className="w-full cursor-pointer text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Unlink channel
            </button>
          ) : null}
        </form>
      )}

      {linked && !editing ? (
        <Button asChild variant="slate" size="tactile-sm" className="mt-3 w-full">
          <Link to="/videos">Submit a video</Link>
        </Button>
      ) : null}
    </VaultCard>
  );
}
