import { cn } from "@/lib/utils";

/** Hex "vault" mark with a play glyph and a coin notch. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <path
        d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25Z"
        className="fill-vault-raised stroke-emerald"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M16 6.4 24.3 11.2v9.6L16 25.6l-8.3-4.8v-9.6Z" className="fill-obsidian" />
      <path d="M13.4 11.6v8.8l7.2-4.4Z" className="fill-emerald" />
      <circle cx="24.6" cy="23.4" r="3.6" className="fill-gold stroke-obsidian" strokeWidth="1.4" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-[0.95rem] font-bold uppercase leading-none tracking-[0.06em]">
        Watch<span className="text-emerald">For</span>Rewards
      </span>
    </span>
  );
}
