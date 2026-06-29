## Fix public Status link sharing

**Problem:** The VP's "Share status link" button copies `window.location.origin + /status`. When the VP is using the preview URL (`id-preview--…lovable.app`), that origin is gated by Lovable workspace sign-in, so recipients are prompted to log in. The `/status` route itself is already public on the published site.

### Changes

1. **`src/routes/_app.opportunities.index.tsx`** — Share button
   - Always copy the published-site URL for `/status`, not `window.location.origin`.
   - Use the project's stable published domain: `https://consyst-teamsync.lovable.app/status`.
   - (Optional small touch: also show the URL in the toast so the VP can verify.)

2. **`src/routes/status.tsx`** — Header rebrand
   - Replace the small "Opportunity Status / Public read-only view" block with:
     - App name line: **TeamSync**
     - Title line: **Opportunity Status**
   - Remove the "Public read-only view" tag entirely.
   - Keep the Consyst logo, search, count, and table exactly as they are.

No backend, RLS, or routing changes — `/status` is already a top-level public route backed by the `get_status_board` RPC with `anon` execute. Only the share-link origin and the page header copy change.