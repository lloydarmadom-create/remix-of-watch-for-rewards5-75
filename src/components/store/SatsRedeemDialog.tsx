import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Zap } from "lucide-react";

import { Field, fieldClass } from "@/components/auth/AuthPanel";
import { LightningHelp } from "@/components/store/LightningHelp";
import { RedeemProgress, useRedeemRunner } from "@/components/store/RedeemProgress";
import { RedeemDialogFrame, StepDots } from "@/components/store/StoreBits";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { refreshPayouts } from "@/hooks/use-payouts";
import { validateLightningDestination, type Reward } from "@/lib/payouts";
import { redeemSats } from "@/lib/payouts.functions";
import { cn } from "@/lib/utils";

const KIND_LABEL = { address: "Lightning Address", lnurl: "LNURL", bolt11: "Lightning invoice" } as const;

export function SatsRedeemDialog({ reward, open, onOpenChange }: { reward: Reward; open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const redeem = useServerFn(redeemSats);
  const runner = useRedeemRunner();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const check = validateLightningDestination(value, reward.payout);
  const showError = touched && value.trim() !== "" && !check.ok;

  const close = (o: boolean) => {
    if (!o && runner.state.phase === "running") return;
    onOpenChange(o);
    if (!o)
      window.setTimeout(() => {
        setValue("");
        setTouched(false);
        setSubmitted(null);
        runner.reset();
      }, 200);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!check.ok) return;
    setSubmitted(check.value);
    void runner.run(() => redeem({ data: { destination: check.value } })).then((res) => {
      if (res.ok) refreshPayouts(queryClient);
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <RedeemDialogFrame title={`Redeem ${reward.title}`} description={`${reward.coins.toLocaleString("en-US")} coins · sent over Bitcoin Lightning`}>
        <StepDots steps={["Wallet", "Payout"]} current={submitted ? 1 : 0} />
        {!submitted ? (
          <form onSubmit={onSubmit} noValidate className="space-y-3">
            <Field label="Lightning Address, LNURL or invoice" htmlFor="ln-dest" error={showError && !check.ok ? check.error : undefined}>
              <input
                id="ln-dest"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="you@walletofsatoshi.com"
                className={cn(fieldClass, "font-mono text-xs")}
              />
            </Field>
            {check.ok ? (
              <p className="flex items-center gap-1.5 text-xs text-emerald">
                <Zap className="size-3.5" /> {KIND_LABEL[check.kind]}
                {check.wallet ? ` · ${check.wallet}` : ""}
                {check.kind === "address" ? " · we'll confirm it with your wallet" : ""}
              </p>
            ) : null}
            <LightningHelp />
            <p className="text-xs text-muted-foreground">
              Invoices must be for exactly {reward.payout} sats or have no amount. Email addresses are not Lightning wallets.
            </p>
            <Button type="submit" variant="gold" size="tactile" className="w-full">
              <Zap /> Redeem {reward.title}
            </Button>
          </form>
        ) : (
          <RedeemProgress
            state={runner.state}
            verifyLabel="Verifying your Lightning wallet"
            reward={reward}
            destination={submitted}
            onRetry={() => {
              runner.reset();
              setSubmitted(null);
            }}
            onClose={() => close(false)}
          />
        )}
      </RedeemDialogFrame>
    </Dialog>
  );
}
