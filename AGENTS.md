# TeamSync — Project Notes

## Technical decisions

- Optional features (`vendor_enquiries`, `status_board`) are gated by the `features` key in the `app_settings` table (both default OFF when the row is missing). UI gating: `src/lib/features.ts` + `src/hooks/use-features.ts` + `src/components/FeatureGate.tsx` (nav filter, route guard, inline gates). Public routes must enforce server-side: `getStatusBoard` in `src/lib/status.functions.ts` checks the flag with the admin client before calling `get_status_board`. Do not bypass the gate with direct DB reads for these features.
- RLS policies must call role helpers with an explicit schema: use `app_private.has_role(...)`, never unqualified `has_role(...)` — `public.has_role` is not executable by `authenticated`, and unqualified resolution breaks writes with "permission denied for function has_role".
