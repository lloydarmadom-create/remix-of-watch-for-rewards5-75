<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

<!-- AGENT-MEMORY:BEGIN -->
- App shell (TopBar, main Outlet, SiteFooter, BottomNav, CookieConsent) lives in `src/routes/__root.tsx`; pages render only their own content. Why: one shared mobile layout.
- Each bottom-nav tab is its own route file (`/` is Earn); `/admin` is unlinked and noindex. Why: shareable per-page metadata.
- Cookie consent goes only through `src/lib/consent.ts` (copied unchanged from the consent skill) and the defaults script in `src/lib/consent-defaults.ts`, which must stay the first root head script. Why: Consent Mode must be set before any tag loads.
- Reusable visuals (vault cards, chips, icon tiles, tactile button variants) live in `src/components/vault` and `components/ui/button.tsx`; styles come from tokens/utilities in `src/styles.css`. Why: no ad hoc colors.
<!-- AGENT-MEMORY:END -->
