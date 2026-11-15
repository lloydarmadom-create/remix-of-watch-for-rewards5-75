import type { ReactNode } from "react";
import { Bitcoin, Gamepad2, ScrollText, ShieldCheck } from "lucide-react";

import { DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { REWARDS, STOCK_CAPACITY, type RewardCategory } from "@/lib/payouts";
import { cn } from "@/lib/utils";

const POLICY = [
  "Coins are reward points with no cash value. They can only be spent in this Store.",
  `Each payout takes coins and vault stock the moment you redeem. Sats have a ${REWARDS.sats_20.cooldownHours}-hour cooldown and Robux a ${REWARDS.robux_5.cooldownHours / 24}-day cooldown, tracked separately.`,
  "Every payout is reviewed and sent by hand. Track its status in History.",
  "Robux are paid by buying a Gamepass you own at the exact price shown. Roblox keeps its marketplace fee.",
  "Your first verified Roblox username is locked to your account. Changing it needs admin approval.",
  "Rejected payouts are refunded in full: your coins and the vault stock go back.",
  "Alt accounts, bots, VPN farming or fake wallets lead to rejection and a ban. All admin decisions are 100% final with no appeals.",
];

export function PolicyCard() {
  return (
    <VaultCard accent="gold" className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <IconTile tone="gold">
          <ScrollText />
        </IconTile>
        <div>
          <h2 className="font-display font-semibold">Payout & Reward Policy</h2>
          <p className="text-xs text-muted-foreground">Read this before you redeem.</p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {POLICY.map((line) => (
          <li key={line} className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-gold" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </VaultCard>
  );
}

export function VaultStockBars({ sats, robux }: { sats: number | undefined; robux: number | undefined }) {
  return (
    <VaultCard className="animate-rise space-y-3.5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Vault stock
        </h2>
        <Chip tone="cyan">Live</Chip>
      </div>
      <StockBar category="sats" label="Sats" value={sats} icon={<Bitcoin className="size-4 text-gold" />} />
      <StockBar category="robux" label="Robux" value={robux} icon={<Gamepad2 className="size-4 text-emerald" />} />
    </VaultCard>
  );
}

function StockBar({ category, label, value, icon }: { category: RewardCategory; label: string; value: number | undefined; icon: ReactNode }) {
  const v = value ?? 0;
  const cap = Math.max(STOCK_CAPACITY[category], v);
  const smallest = category === "sats" ? REWARDS.sats_20.stockCost : REWARDS.robux_5.stockCost;
  const out = value !== undefined && v < smallest;
  const low = !out && v < smallest * 10;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-semibold">
          {icon} {label}
        </span>
        <span className={cn("font-mono tabular-nums", out ? "text-destructive" : low ? "text-gold" : "text-foreground")}>
          {value === undefined ? "…" : out ? "Out of stock" : `${v.toLocaleString("en-US")} left`}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-vault-inner">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            category === "sats" ? "bg-gold" : "bg-emerald",
          )}
          style={{ width: `${value === undefined ? 0 : Math.min(100, (v / cap) * 100)}%` }}
        />
      </div>
    </div>
  );
}

/** Shared frame for the redeem windows. */
export function RedeemDialogFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <DialogContent className="vault max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto border-vault-rim bg-vault p-4">
      <DialogTitle className="pr-6 text-base font-bold">{title}</DialogTitle>
      <DialogDescription className="-mt-1 text-xs text-muted-foreground">{description}</DialogDescription>
      {children}
    </DialogContent>
  );
}

/** "1 Username · 2 Gamepass · 3 Payout" style step header. */
export function StepDots({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => (
        <li key={s} className="text-center">
          <div className={cn("h-1.5 rounded-full", i <= current ? "bg-emerald" : "bg-muted")} />
          <p className={cn("mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em]", i === current ? "text-foreground" : "text-muted-foreground")}>
            {i + 1}. {s}
          </p>
        </li>
      ))}
    </ol>
  );
}
