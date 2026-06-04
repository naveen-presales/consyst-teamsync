## Goal
The first person to sign up should become Admin and be signed in immediately after clicking "Create account" — no email verification, no "awaiting approval" screen. All subsequent signups keep the current behavior (pending approval, email confirmation as configured).

## Current state
- The DB trigger `handle_new_user` already promotes the first profile to `role=admin` and `status=approved`. Good.
- `src/routes/signup.tsx` calls `supabase.auth.signUp(...)`. If email confirmation is enabled on the project, the call returns no session, so even the first user can't sign in until they click the confirmation email. The UI also unconditionally shows "Awaiting admin approval".

## Approach
Add a server function that handles signup with first-user detection:

1. **New server function** `src/lib/signup.functions.ts` → `signUpUser({ email, password, fullName })`:
   - Validates `@consyst.biz` domain server-side (closes the existing client-only gate).
   - Uses `supabaseAdmin` to check if `profiles` is empty.
   - If empty (first user): `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })` so the account is confirmed instantly. Returns `{ firstUser: true }`.
   - Otherwise: normal `supabase.auth.signUp(...)` flow (or admin create with `email_confirm:false`). Returns `{ firstUser: false }`.
   - The existing `handle_new_user` trigger still runs and assigns admin/approved vs architect/pending correctly.

2. **Update `src/routes/signup.tsx`**:
   - Call the new server fn instead of `supabase.auth.signUp` directly.
   - If `firstUser === true`: immediately call `supabase.auth.signInWithPassword({ email, password })` on the client (so the session lands in localStorage), then `navigate({ to: "/dashboard" })`. Toast: "Welcome, admin".
   - Otherwise: keep current "Awaiting admin approval" toast and send to `/login`.

3. **No DB migration needed** — `handle_new_user` already does the right thing.

## Files touched
- `src/lib/signup.functions.ts` (new)
- `src/routes/signup.tsx` (swap submit handler)

## Out of scope
- No changes to login, approval queue, or the architect signup flow.
- Not changing global `auto_confirm_email` setting (would affect every user).