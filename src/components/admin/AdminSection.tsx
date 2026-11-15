import type { ReactNode } from "react";

import { Chip } from "@/components/vault/VaultCard";

/** Heading row used by every admin panel list. */
export function AdminSection({
  id,
  icon,
  title,
  count,
  countTone = "muted",
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  count?: string;
  countTone?: "emerald" | "cyan" | "gold" | "muted";
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-2.5">
      <div className="flex items-center justify-between px-1 pt-2">
        <h2
          id={id}
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground [&_svg]:size-4"
        >
          {icon} {title}
        </h2>
        {count ? <Chip tone={countTone}>{count}</Chip> : null}
      </div>
      {children}
    </section>
  );
}

export const shortId = (id: string) => id.slice(0, 8);
