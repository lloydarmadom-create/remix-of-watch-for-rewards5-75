import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5 animate-rise">
      <p className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-emerald">
        {eyebrow}
      </p>
      <h1 className="mt-1 text-[1.7rem] font-bold leading-tight text-foreground">{title}</h1>
      {children ? <p className="mt-1.5 text-sm text-muted-foreground">{children}</p> : null}
    </header>
  );
}
