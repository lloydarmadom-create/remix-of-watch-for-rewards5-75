import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { openCookieSettings } from "@/components/consent/CookieConsent";
import { PageHeader } from "@/components/layout/PageHeader";
import { VaultCard } from "@/components/vault/VaultCard";

const DESCRIPTION =
  "How Watch For Rewards handles your data: email-only accounts, a 13+ audience, analytics, advertising cookies and final admin decisions.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — Watch For Rewards" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Privacy policy — Watch For Rewards" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <VaultCard as="section" className="p-5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-xs font-semibold text-emerald">{n}</span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <div className="mt-2.5 space-y-2.5 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_a]:text-cyan [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </VaultCard>
  );
}

function PrivacyPage() {
  return (
    <article className="space-y-3">
      <PageHeader eyebrow="Legal" title="Privacy policy.">
        Last updated November 15, 2026
      </PageHeader>

      <Section n="01" title="Who this is for">
        <p>
          Watch For Rewards is a gaming and crypto rewards app for players aged{" "}
          <strong>13 and older</strong>. If you are under 13, please don't use the app or create an
          account. If we learn that an account belongs to someone under 13, we will close it and
          delete its data.
        </p>
      </Section>

      <Section n="02" title="What we collect">
        <p>
          To create an account we ask for <strong>your email address only</strong>. We use it to
          sign you in, keep your points and rewards tied to you, and send messages about your
          account. We don't ask for your name, home address, phone number or date of birth, and we
          don't sell your email address.
        </p>
      </Section>

      <Section n="03" title="Visitor analytics">
        <p>
          We use Lovable's built-in analytics to understand how the app is used. It uses no
          cookies, stores nothing on your device, doesn't keep IP addresses and doesn't identify
          you. Lovable collects this data for us.{" "}
          <a href="https://lovable.dev/privacy" target="_blank" rel="noreferrer">
            Lovable's privacy policy
          </a>{" "}
          explains how it handles it.
        </p>
        <p>It records:</p>
        <ul>
          <li>the pages you visit and where you came from</li>
          <li>your country, browser, operating system and device type</li>
          <li>how long you stay, how fast pages load, and errors</li>
          <li>the buttons and links you click</li>
        </ul>
        <p>Detailed data is kept for 90 days, and daily summaries for a year.</p>
        <p>
          <strong>Clicks</strong> are recorded only after you accept analytics if you visit from the
          EU/EEA, the UK, Switzerland or Canada. For everyone else they are recorded unless your
          browser sends a Global Privacy Control signal. If your browser sends that signal, clicks
          are never recorded, even if you accept. Page visits, time on page, page speed and errors
          are recorded for every visitor, without cookies and without identifying anyone.
        </p>
      </Section>

      <Section n="04" title="Advertising partners and cookies">
        <p>
          We work with <strong>third-party advertising partners</strong> to show ads and measure how
          they perform. These partners may set cookies or similar technologies on your device and
          receive information such as the pages you view and how you interact with ads. Each partner
          handles that data under its own privacy policy.
        </p>
        <p>
          In the EU/EEA, the UK and Switzerland, and in Quebec, advertising cookies stay off until
          you accept them. You can accept, reject or change your choice at any time in{" "}
          <button
            type="button"
            onClick={openCookieSettings}
            className="cursor-pointer text-cyan underline underline-offset-4"
          >
            Cookie settings
          </button>
          . Your choice is saved in your browser for up to 12 months.
        </p>
      </Section>

      <Section n="05" title="Other services we load">
        <p>
          Our pages load fonts from Google Fonts. When they load, Google receives your browser's IP
          address and basic browser details.
        </p>
      </Section>

      <Section n="06" title="Admin decisions are final">
        <p>
          Our admin team reviews accounts, points, reward redemptions and payouts to keep the app
          fair. <strong>All admin decisions are 100% final and cannot be appealed.</strong> This
          includes approving or denying rewards, adjusting balances, and suspending or closing
          accounts.
        </p>
      </Section>

      <Section n="07" title="Your choices and contact">
        <p>
          You can ask us to delete your account and email address at any time. Reach our team
          through the support option in your Profile tab. For everyone's safety, we don't publish
          staff email addresses.
        </p>
      </Section>

      <Section n="08" title="Not affiliated">
        <p>
          Watch For Rewards is an independent service and is not affiliated with, endorsed by, or
          sponsored by Roblox Corporation.
        </p>
      </Section>
    </article>
  );
}
