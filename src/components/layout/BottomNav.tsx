import { Link } from "@tanstack/react-router";
import { Coins, History, Play, ShoppingBag, UserRound, type LucideIcon } from "lucide-react";

type Tab = {
  to: "/" | "/videos" | "/store" | "/history" | "/profile";
  label: string;
  icon: LucideIcon;
};

const TABS: Tab[] = [
  { to: "/", label: "Earn", icon: Coins },
  { to: "/videos", label: "Videos", icon: Play },
  { to: "/store", label: "Store", icon: ShoppingBag },
  { to: "/history", label: "History", icon: History },
  { to: "/profile", label: "Profile", icon: UserRound },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-vault-rim bg-obsidian/92 backdrop-blur-lg pb-safe"
    >
      <ul className="mx-auto grid w-full max-w-lg grid-cols-5 px-2 pt-1.5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="group relative flex flex-col items-center gap-1 rounded-xl py-1.5 text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-emerald"
            >
              <span
                aria-hidden
                className="absolute -top-1.5 h-0.5 w-8 rounded-full bg-emerald opacity-0 shadow-glow-emerald transition-opacity group-data-[status=active]:opacity-100"
              />
              <span className="grid size-9 place-items-center rounded-xl transition-colors group-data-[status=active]:bg-emerald/10 group-data-[status=active]:ring-1 group-data-[status=active]:ring-emerald/25">
                <Icon className="size-[1.15rem]" strokeWidth={2.2} />
              </span>
              <span className="font-display text-[0.62rem] font-semibold uppercase tracking-[0.14em]">
                {label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
