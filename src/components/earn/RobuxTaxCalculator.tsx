import { useState } from "react";
import { ArrowDownUp, Calculator } from "lucide-react";

import { fieldClass } from "@/components/auth/AuthPanel";
import { IconTile, VaultCard } from "@/components/vault/VaultCard";
import { gamepassPriceFor, robuxReceived } from "@/lib/earning";

type Mode = "receive" | "price";

const fmt = (n: number) => n.toLocaleString("en-US");

export function RobuxTaxCalculator() {
  const [mode, setMode] = useState<Mode>("receive");
  const [raw, setRaw] = useState("1000");
  const value = Math.min(100_000_000, Math.max(0, Math.floor(Number(raw) || 0)));

  const price = mode === "receive" ? gamepassPriceFor(value) : value;
  const received = robuxReceived(price);
  const tax = price - received;

  return (
    <VaultCard className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <IconTile tone="gold">
          <Calculator />
        </IconTile>
        <div>
          <h3 className="font-display font-semibold">Robux tax calculator</h3>
          <p className="text-xs text-muted-foreground">Roblox keeps 30% of every Game Pass sale.</p>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="robux-input" className="mb-1.5 flex items-center justify-between font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {mode === "receive" ? "Robux you want to receive" : "Game Pass price"}
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "receive" ? "price" : "receive"));
              setRaw(String(mode === "receive" ? price : received));
            }}
            className="flex cursor-pointer items-center gap-1 text-cyan normal-case tracking-normal"
          >
            <ArrowDownUp className="size-3.5" /> Switch
          </button>
        </label>
        <input
          id="robux-input"
          type="number"
          inputMode="numeric"
          min={0}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className={`${fieldClass} font-mono`}
        />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Cell label="Set price" value={fmt(price)} highlight={mode === "receive"} />
        <Cell label="30% tax" value={`−${fmt(tax)}`} />
        <Cell label="You get" value={fmt(received)} highlight={mode === "price"} />
      </dl>
    </VaultCard>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-xl bg-gold/10 p-2.5 ring-1 ring-gold/30" : "vault-well p-2.5"}>
      <dt className="font-display text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className={highlight ? "mt-1 font-mono text-sm font-semibold text-gold" : "mt-1 font-mono text-sm font-semibold"}>
        {value}
      </dd>
    </div>
  );
}
