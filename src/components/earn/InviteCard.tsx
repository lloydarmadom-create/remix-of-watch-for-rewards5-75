import { useEffect, useState } from "react";
import { Check, Copy, Share2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { useProfile } from "@/hooks/use-auth";
import { useEarnStatus } from "@/hooks/use-earn";
import { REFERRAL_ADS, REFERRAL_COINS } from "@/lib/earning";
import { referralLink } from "@/lib/referral";

export function InviteCard() {
  const { data: profile } = useProfile();
  const { data: status } = useEarnStatus();
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    if (profile?.referral_code) setLink(referralLink(window.location.origin, profile.referral_code));
  }, [profile?.referral_code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Watch For Rewards", text: "Earn rewards with me:", url: link });
      } catch {
        /* cancelled */
      }
    } else {
      void copy();
    }
  };

  return (
    <VaultCard accent="emerald" className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <IconTile tone="emerald">
          <Users />
        </IconTile>
        <div className="flex-1">
          <p className="font-display font-semibold">Invite friends</p>
          <p className="text-xs text-muted-foreground">
            +{REFERRAL_COINS} Coin every time a friend you invite finishes {REFERRAL_ADS} ads.
          </p>
        </div>
        <Chip tone="emerald">{status?.invited_count ?? 0} joined</Chip>
      </div>

      <div className="vault-well mt-4 flex items-center gap-2 p-1.5 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={link}>
          {link || "Loading your link…"}
        </span>
        <Button variant="slate" size="tactile-sm" onClick={copy} disabled={!link} aria-label="Copy invite link">
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="font-display text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
          Code <span className="font-mono text-sm tracking-[0.18em] text-gold">{profile?.referral_code ?? "········"}</span>
        </span>
        <Button variant="emerald" size="tactile-sm" onClick={share} disabled={!link}>
          <Share2 /> Share
        </Button>
      </div>
    </VaultCard>
  );
}
