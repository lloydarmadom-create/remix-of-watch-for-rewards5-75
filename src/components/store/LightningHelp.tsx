import { HelpCircle } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "How to get a free Lightning wallet in 60s" help bubble. */
export function LightningHelp() {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-cyan underline-offset-4 hover:underline">
        <HelpCircle className="size-3.5" /> How to get a free Lightning wallet in 60s
      </PopoverTrigger>
      <PopoverContent className="vault w-[min(20rem,calc(100vw-2rem))] border-vault-rim bg-vault-raised p-4 text-sm" align="start">
        <p className="font-display font-semibold">Free Lightning wallet in 60s</p>
        <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
          <li>
            Install a free wallet such as <span className="text-foreground">Wallet of Satoshi</span>,{" "}
            <span className="text-foreground">Blink</span> or <span className="text-foreground">ZBD</span>, or open{" "}
            <span className="text-foreground">Coinos</span> in your browser.
          </li>
          <li>Create your account. No bank card needed.</li>
          <li>
            Tap <span className="text-foreground">Receive</span> and copy your Lightning Address. It looks like{" "}
            <span className="font-mono text-foreground">name@walletofsatoshi.com</span>.
          </li>
          <li>Paste it here. Don't use your email address: Sats sent there are lost.</li>
        </ol>
        <p className="mt-2.5 text-[0.7rem] text-muted-foreground">
          Under 18? Ask a parent or guardian before you set up a wallet.
        </p>
      </PopoverContent>
    </Popover>
  );
}
