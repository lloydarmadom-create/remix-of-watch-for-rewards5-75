import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, ExternalLink, Loader2, UserRound } from "lucide-react";

import { Field, fieldClass } from "@/components/auth/AuthPanel";
import { RedeemProgress, useRedeemRunner } from "@/components/store/RedeemProgress";
import { RedeemDialogFrame, StepDots } from "@/components/store/StoreBits";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Chip } from "@/components/vault/VaultCard";
import { useProfile } from "@/hooks/use-auth";
import { refreshPayouts } from "@/hooks/use-payouts";
import { normalizeRobloxUsername, parseGamepassId, type Reward } from "@/lib/payouts";
import { redeemRobux, verifyRobloxUsername } from "@/lib/payouts.functions";
import { cn } from "@/lib/utils";

type Account = { username: string; displayName: string; robloxId: number; avatarUrl: string | null };
type Step = "account" | "gamepass" | "payout";

export function RobuxRedeemDialog({ reward, open, onOpenChange }: { reward: Reward; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const verify = useServerFn(verifyRobloxUsername);
  const redeem = useServerFn(redeemRobux);
  const runner = useRedeemRunner();

  const fromProfile: Account | null =
    profile?.roblox_user_id && profile.roblox_username
      ? {
          username: profile.roblox_username,
          displayName: profile.roblox_display_name ?? profile.roblox_username,
          robloxId: profile.roblox_user_id,
          avatarUrl: profile.roblox_avatar_url,
        }
      : null;

  const [fresh, setFresh] = useState<Account | null>(null);
  // Show a just-verified account right away, before the profile refetch lands.
  const locked = fromProfile ?? fresh;
  const [step, setStep] = useState<Step>("account");
  const [changing, setChanging] = useState(false);
  const [username, setUsername] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gamepass, setGamepass] = useState("");
  const [gamepassError, setGamepassError] = useState<string | null>(null);

  const reset = () => {
    setStep("account");
    setChanging(false);
    setUsername("");
    setAccountError(null);
    setNotice(null);
    setGamepass("");
    setGamepassError(null);
    runner.reset();
  };

  const close = (o: boolean) => {
    if (!o && runner.state.phase === "running") return; // never close mid-request
    onOpenChange(o);
    if (!o) window.setTimeout(reset, 200);
  };

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    setNotice(null);
    if (!normalizeRobloxUsername(username)) {
      setAccountError("Roblox usernames are 3–20 letters, numbers or underscores.");
      return;
    }
    setVerifying(true);
    try {
      const res = await verify({ data: { username } });
      if (!res.ok) {
        setAccountError(res.error);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["roblox_change"] });
      if (res.status === "change_requested") {
        setNotice(`Change to “${res.username}” sent to the admin for approval. You can keep redeeming with your current account.`);
        setChanging(false);
        setUsername("");
        return;
      }
      setFresh({ username: res.username, displayName: res.displayName, robloxId: res.robloxId, avatarUrl: res.avatarUrl });
      setChanging(false);
      setUsername("");
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Roblox didn't answer. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  const onRedeem = (e: FormEvent) => {
    e.preventDefault();
    if (!parseGamepassId(gamepass)) {
      setGamepassError("Paste your Gamepass link (roblox.com/game-pass/…) or its number ID.");
      return;
    }
    setGamepassError(null);
    setStep("payout");
    void runner.run(() => redeem({ data: { reward: reward.id as "robux_5" | "robux_10", gamepass: gamepass.trim() } })).then((res) => {
      if (res.ok) refreshPayouts(queryClient);
    });
  };

  const stepIndex = step === "account" ? 0 : step === "gamepass" ? 1 : 2;
  const showForm = !locked || changing;

  return (
    <Dialog open={open} onOpenChange={close}>
      <RedeemDialogFrame
        title={`Redeem ${reward.title}`}
        description={`${reward.coins.toLocaleString("en-US")} coins · paid by buying your ${reward.gamepassPrice} Robux Gamepass`}
      >
        <StepDots steps={["Username", "Gamepass", "Payout"]} current={stepIndex} />

        {step === "account" ? (
          <div className="space-y-3">
            {locked && !changing ? <AccountCard account={locked} /> : null}
            {notice ? <p className="rounded-lg bg-cyan/10 px-3 py-2.5 text-xs text-cyan ring-1 ring-cyan/25">{notice}</p> : null}
            {showForm ? (
              <form onSubmit={onVerify} noValidate className="space-y-3">
                <Field label="Roblox username" htmlFor="rbx-user" error={accountError ?? undefined}>
                  <input
                    id="rbx-user"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.slice(0, 40))}
                    placeholder="e.g. Builderman"
                    className={cn(fieldClass, "font-mono")}
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  {locked
                    ? "Your username is locked. A change goes to the admin for approval."
                    : "We check it live on Roblox. Your first verified username is locked to this account."}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {locked ? (
                    <Button type="button" variant="slate" size="tactile-sm" onClick={() => setChanging(false)}>
                      Cancel
                    </Button>
                  ) : null}
                  <Button type="submit" variant="cyan" size="tactile-sm" className={locked ? "" : "col-span-2"} disabled={verifying}>
                    {verifying ? <Loader2 className="animate-spin" /> : <BadgeCheck />} Verify on Roblox
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="slate" size="tactile-sm" onClick={() => setChanging(true)}>
                  Change username
                </Button>
                <Button variant="emerald" size="tactile-sm" onClick={() => setStep("gamepass")}>
                  Continue
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {step === "gamepass" ? (
          <form onSubmit={onRedeem} noValidate className="space-y-3">
            <div className="vault-well space-y-2 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Set up your Gamepass</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Open the Roblox Creator Hub and pick one of your own experiences.</li>
                <li>Create a Gamepass under Monetization → Passes.</li>
                <li>
                  Turn on <span className="text-foreground">Item for Sale</span> and set the price to exactly{" "}
                  <span className="font-mono font-semibold text-gold">{reward.gamepassPrice} Robux</span>.
                </li>
                <li>Copy the Gamepass link and paste it below.</li>
              </ol>
              <a
                href="https://create.roblox.com/dashboard/creations"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-cyan underline-offset-4 hover:underline"
              >
                Open Creator Hub <ExternalLink className="size-3" />
              </a>
            </div>
            <Field label="Gamepass link or ID" htmlFor="rbx-pass" error={gamepassError ?? undefined}>
              <input
                id="rbx-pass"
                autoComplete="off"
                spellCheck={false}
                value={gamepass}
                onChange={(e) => setGamepass(e.target.value.slice(0, 300))}
                placeholder="https://www.roblox.com/game-pass/123456789"
                className={cn(fieldClass, "font-mono text-xs")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="slate" size="tactile-sm" onClick={() => setStep("account")}>
                Back
              </Button>
              <Button type="submit" variant="emerald" size="tactile-sm">
                Verify & redeem
              </Button>
            </div>
          </form>
        ) : null}

        {step === "payout" ? (
          <RedeemProgress
            state={runner.state}
            verifyLabel={`Verifying your ${reward.gamepassPrice} Robux Gamepass`}
            reward={reward}
            destination={`Gamepass ${parseGamepassId(gamepass) ?? ""} · ${locked?.username ?? ""}`}
            onRetry={() => {
              const back = runner.state.failed?.step === 3 ? "gamepass" : "account";
              runner.reset();
              setStep(back);
            }}
            onClose={() => close(false)}
          />
        ) : null}
      </RedeemDialogFrame>
    </Dialog>
  );
}

function AccountCard({ account }: { account: Account }) {
  return (
    <div className="vault-well flex items-center gap-3 p-3">
      {account.avatarUrl ? (
        <img src={account.avatarUrl} alt="" className="size-14 rounded-xl bg-vault-inner object-cover ring-1 ring-border" />
      ) : (
        <span className="grid size-14 place-items-center rounded-xl bg-vault-inner ring-1 ring-border">
          <UserRound className="size-6 text-muted-foreground" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-semibold">{account.displayName}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">@{account.username}</p>
        <p className="font-mono text-[0.68rem] text-muted-foreground">ID {account.robloxId}</p>
      </div>
      <Chip tone="emerald">Verified</Chip>
    </div>
  );
}
