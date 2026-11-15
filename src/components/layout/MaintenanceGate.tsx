import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { LogIn, LogOut, ShieldAlert, Wrench } from "lucide-react";

import { AuthPanel } from "@/components/auth/AuthPanel";
import { Wordmark } from "@/components/brand/Logo";
import { openContactSupport } from "@/components/support/ContactSupport";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VaultCard } from "@/components/vault/VaultCard";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings, useIsAdmin } from "@/hooks/use-earn";
import { supabase } from "@/integrations/supabase/client";

// The privacy policy stays readable during maintenance.
const OPEN_PATHS = new Set(["/privacy"]);

/** Shows the Vault Maintenance screen when maintenance mode is on. The admin account bypasses it. */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: settings } = useAppSettings();
  const isAdmin = useIsAdmin();
  const { pathname } = useLocation();

  const on = settings?.maintenance_mode === true;
  const admin = !!user && isAdmin.data === true;

  if (!on || OPEN_PATHS.has(pathname)) return <>{children}</>;
  if (admin) {
    return (
      <>
        <div className="bg-gold/15 px-4 py-2 text-center font-display text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gold ring-1 ring-gold/30">
          Maintenance mode is on · only you can see the app
        </div>
        {children}
      </>
    );
  }
  return <MaintenanceScreen message={settings?.maintenance_message ?? ""} />;
}

function MaintenanceScreen({ message }: { message: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loginOpen, setLoginOpen] = useState(false);

  const signOut = async () => {
    queryClient.clear();
    await supabase.auth.signOut();
  };

  return (
    <div className="app-backdrop flex min-h-dvh flex-col items-center justify-center px-4 pb-40 pt-10">
      <Wordmark />
      <VaultCard accent="gold" className="animate-rise mt-8 w-full max-w-sm p-6 text-center">
        <div className="relative mx-auto grid size-20 place-items-center">
          <span aria-hidden className="absolute inset-0 animate-spin rounded-full border-2 border-dashed border-gold/40 [animation-duration:8s]" />
          <span className="grid size-14 place-items-center rounded-2xl bg-gold/12 text-gold ring-1 ring-gold/30 shadow-glow-gold">
            <Wrench className="size-7" />
          </span>
        </div>
        <p className="mt-5 font-display text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-gold">
          Vault maintenance
        </p>
        <h1 className="mt-2 text-2xl font-bold">The vault is locked.</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <p className="vault-well mt-5 p-3 text-xs text-muted-foreground">
          Your coins, streak and invites are safe. Come back soon.
        </p>
        <Button variant="slate" size="tactile-sm" className="mt-5 w-full" onClick={openContactSupport}>
          Contact support
        </Button>
      </VaultCard>

      <div className="mt-6 flex flex-col items-center gap-2 text-xs text-muted-foreground">
        {user ? (
          <>
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="size-3.5" /> Signed in as {user.email}
            </span>
            <button type="button" onClick={signOut} className="flex cursor-pointer items-center gap-1 hover:text-foreground">
              <LogOut className="size-3.5" /> Log out
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 ring-1 ring-border hover:text-foreground"
          >
            <LogIn className="size-3.5" /> Log in
          </button>
        )}
        <Link to="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
          Privacy policy
        </Link>
        <p className="font-display text-[0.62rem] uppercase tracking-[0.18em]">Not affiliated with Roblox Corporation.</p>
      </div>

      <Dialog open={loginOpen && !user} onOpenChange={setLoginOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Log in</DialogTitle>
          <DialogDescription className="sr-only">Log in with your email and password.</DialogDescription>
          <AuthPanel initialMode="login" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
