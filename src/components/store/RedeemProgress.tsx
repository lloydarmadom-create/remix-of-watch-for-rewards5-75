import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, CheckCircle2, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCoins } from "@/lib/earning";
import type { RedeemResult } from "@/lib/payouts.functions";
import type { Reward } from "@/lib/payouts";
import { cn } from "@/lib/utils";

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

export type RunnerState = {
  phase: "idle" | "running" | "done" | "failed";
  /** Active step 1–5; 6 once every step is done. */
  step: number;
  failed: { step: number; error: string } | null;
};

/** Drives the 5-step progress overlay around one server redemption call. */
export function useRedeemRunner() {
  const [state, setState] = useState<RunnerState>({ phase: "idle", step: 0, failed: null });

  const run = useCallback(async (call: () => Promise<RedeemResult>) => {
    setState({ phase: "running", step: 1, failed: null });
    const pending: Promise<RedeemResult> = call().catch((err: unknown) => ({
      ok: false as const,
      stage: 2 as const,
      error: err instanceof Error && err.message ? err.message : "We couldn't start a secure request. Please try again.",
    }));
    await sleep(450);
    setState((s) => ({ ...s, step: 2 }));
    await sleep(550);
    setState((s) => ({ ...s, step: 3 }));
    const res = await pending;
    if (!res.ok) {
      setState({ phase: "failed", step: res.stage, failed: { step: res.stage, error: res.error } });
      return res;
    }
    setState((s) => ({ ...s, step: 4 }));
    await sleep(600);
    setState((s) => ({ ...s, step: 5 }));
    await sleep(600);
    setState({ phase: "done", step: 6, failed: null });
    return res;
  }, []);

  const reset = useCallback(() => setState({ phase: "idle", step: 0, failed: null }), []);
  return { state, run, reset };
}

export function RedeemProgress({
  state,
  verifyLabel,
  reward,
  destination,
  onRetry,
  onClose,
}: {
  state: RunnerState;
  verifyLabel: string;
  reward: Reward;
  destination: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  const steps = [
    "Preparing secure request",
    "Checking account & cooldown",
    verifyLabel,
    "Deducting coins & vault stock",
    "Queuing your payout",
  ];
  const doneCount = state.phase === "done" ? 5 : Math.max(0, state.step - 1);

  if (state.phase === "done") {
    return (
      <div className="animate-rise py-2 text-center" role="status">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald/10 ring-2 ring-emerald/40 shadow-glow-emerald">
          <CheckCircle2 className="size-8 text-emerald" />
        </div>
        <h3 className="mt-4 font-display text-xl font-bold">Queued for Payout</h3>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
          Your {reward.title} request is in the payout queue. The admin reviews and sends every payout by hand.
        </p>
        <div className="vault-well mt-4 space-y-1.5 p-3 text-left text-xs">
          <Row label="Reward" value={reward.title} />
          <Row label="Coins spent" value={`−${formatCoins(reward.coins)}`} />
          <Row label="Send to" value={destination} mono />
          <Row label="Status" value="Pending" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button asChild variant="slate" size="tactile-sm">
            <Link to="/history" onClick={onClose}>
              Track in History
            </Link>
          </Button>
          <Button variant="emerald" size="tactile-sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-1" aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            state.phase === "failed" ? "bg-destructive" : "bg-gradient-to-r from-cyan to-emerald",
          )}
          style={{ width: `${(doneCount / 5) * 100 + (state.phase === "running" ? 10 : 0)}%` }}
        />
      </div>
      <ol className="mt-4 space-y-2.5">
        {steps.map((label, i) => {
          const n = i + 1;
          const failed = state.failed?.step === n;
          const done = n < state.step && !failed;
          const active = state.phase === "running" && n === state.step;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                active && "bg-cyan/8 ring-1 ring-cyan/25",
                failed && "bg-destructive/10 ring-1 ring-destructive/30",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-semibold ring-1",
                  done && "bg-emerald/15 text-emerald ring-emerald/30",
                  active && "bg-cyan/15 text-cyan ring-cyan/30",
                  failed && "bg-destructive/15 text-destructive ring-destructive/30",
                  !done && !active && !failed && "bg-muted text-muted-foreground ring-border",
                )}
              >
                {done ? <Check className="size-4" /> : active ? <Loader2 className="size-4 animate-spin" /> : failed ? <X className="size-4" /> : n}
              </span>
              <span className={cn("text-sm", done || active ? "text-foreground" : failed ? "text-destructive" : "text-muted-foreground")}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      {state.failed ? (
        <div className="mt-4 space-y-3">
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/25">
            {state.failed.error}
          </p>
          <p className="text-xs text-muted-foreground">No coins or stock were taken.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="slate" size="tactile-sm" onClick={onClose}>
              Close
            </Button>
            <Button variant="cyan" size="tactile-sm" onClick={onRetry}>
              Fix & retry
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-all text-right", mono && "font-mono")}>{value}</span>
    </div>
  );
}
