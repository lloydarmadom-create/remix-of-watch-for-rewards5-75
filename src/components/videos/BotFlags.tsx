import { AlertTriangle, Bot, CheckCircle2, Info } from "lucide-react";

import { Chip } from "@/components/vault/VaultCard";
import type { BotFlag, RiskLevel, ScanStatus } from "@/lib/creator-videos";
import { cn } from "@/lib/utils";

const SCAN_LABEL: Record<ScanStatus | "pending", string> = {
  pending: "Scan pending",
  clean: "Bot: clean",
  flagged: "Bot: flagged",
  partial: "Bot: partial scan",
};

export function ScanChips({ scan, risk }: { scan: ScanStatus | "pending"; risk: RiskLevel }) {
  return (
    <>
      <Chip tone={scan === "clean" ? "emerald" : scan === "flagged" ? "gold" : "muted"}>
        <Bot className="size-3" /> {SCAN_LABEL[scan]}
      </Chip>
      {scan !== "clean" ? (
        <Chip tone={risk === "high" ? "gold" : "muted"} className={cn(risk === "high" && "text-destructive ring-destructive/30 bg-destructive/10")}>
          {risk} risk
        </Chip>
      ) : null}
    </>
  );
}

/** The review bot's findings for one video. */
export function BotFlagList({ flags, className }: { flags: BotFlag[]; className?: string }) {
  if (!flags?.length) {
    return (
      <p className={cn("flex items-center gap-1.5 text-xs text-emerald", className)}>
        <CheckCircle2 className="size-3.5" /> No risk flags found.
      </p>
    );
  }
  return (
    <ul className={cn("space-y-1.5", className)}>
      {flags.map((f) => (
        <li key={f.code} className="flex items-start gap-2 text-xs">
          {f.severity === "low" ? (
            <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <AlertTriangle className={cn("mt-0.5 size-3.5 shrink-0", f.severity === "high" ? "text-destructive" : "text-gold")} />
          )}
          <span>
            <span className="font-semibold text-foreground">{f.label}.</span>{" "}
            <span className="text-muted-foreground">{f.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
