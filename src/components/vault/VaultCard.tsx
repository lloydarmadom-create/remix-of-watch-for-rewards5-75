import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const rim = cva("pointer-events-none absolute inset-x-6 top-0 h-px", {
  variants: {
    accent: {
      none: "hidden",
      emerald: "bg-gradient-to-r from-transparent via-emerald to-transparent",
      cyan: "bg-gradient-to-r from-transparent via-cyan to-transparent",
      gold: "bg-gradient-to-r from-transparent via-gold to-transparent",
    },
  },
  defaultVariants: { accent: "none" },
});

type VaultCardProps = VariantProps<typeof rim> & {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
};

export function VaultCard({ accent, children, className, as: Tag = "div" }: VaultCardProps) {
  return (
    <Tag className={cn("vault relative overflow-hidden p-4", className)}>
      <span aria-hidden className={rim({ accent })} />
      {children}
    </Tag>
  );
}

const chip = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-[0.65rem] font-semibold uppercase tracking-[0.14em]",
  {
    variants: {
      tone: {
        emerald: "bg-emerald/12 text-emerald ring-1 ring-emerald/25",
        cyan: "bg-cyan/12 text-cyan ring-1 ring-cyan/25",
        gold: "bg-gold/12 text-gold ring-1 ring-gold/25",
        muted: "bg-muted text-muted-foreground ring-1 ring-border",
      },
    },
    defaultVariants: { tone: "muted" },
  },
);

export function Chip({
  tone,
  children,
  className,
}: VariantProps<typeof chip> & { children: ReactNode; className?: string }) {
  return <span className={cn(chip({ tone }), className)}>{children}</span>;
}

const iconTile = cva("grid size-11 shrink-0 place-items-center rounded-xl ring-1 [&_svg]:size-5", {
  variants: {
    tone: {
      emerald: "bg-emerald/10 text-emerald ring-emerald/20",
      cyan: "bg-cyan/10 text-cyan ring-cyan/20",
      gold: "bg-gold/10 text-gold ring-gold/20",
      muted: "bg-muted text-muted-foreground ring-border",
    },
  },
  defaultVariants: { tone: "muted" },
});

export function IconTile({
  tone,
  children,
  className,
}: VariantProps<typeof iconTile> & { children: ReactNode; className?: string }) {
  return <span className={cn(iconTile({ tone }), className)}>{children}</span>;
}
