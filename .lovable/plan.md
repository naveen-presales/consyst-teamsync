## What changes

**1. New approval workflow for opportunities**
- Architects no longer create opportunities directly. The "New opportunity" form on `/opportunities` becomes a **request** form for them.
- VPs (and Admins) get a "Create opportunity" form that creates the opportunity directly and assigns exactly one architect.
- Architect-submitted requests show up in a new "Requests" inbox for VPs to **Approve** or **Reject**. On approve, the opportunity is created and assigned to the requesting architect. On reject, the request is marked rejected (with optional note).

**2. Single-architect rule**
- Enforce one architect per opportunity at the database level (unique constraint on `opportunity_architects.opportunity_id`).
- VP create form uses a single-select architect dropdown (not multi).

**3. VP Architect Workload table**
- On the Dashboard, when the user is VP/Admin, render a clean table below the existing chart: Architect · Email · Active opps · In Progress · Completed · Breaches (rev > 2). Sortable by active count. Keep the bar chart for at-a-glance.

## Data model

New table `opportunity_requests`:
- `id`, `requested_by` (uuid → architect), `customer_name`, `project_name`, `crm_number`, `received_date`, `start_date`, `deadline`, `opportunity_type`, `notes`
- `status`: `pending | approved | rejected` (default `pending`)
- `reviewed_by` (uuid, VP), `reviewed_at`, `review_notes`, `created_opportunity_id`
- RLS:
  - Architects: insert their own; select their own.
  - VP/Admin: select all; update (approve/reject).

Add unique index on `opportunity_architects(opportunity_id)` to prevent multi-assignment.

## UI changes

- `/opportunities` (architect view): "New opportunity" button → opens **Request opportunity** dialog. After submit, toast "Request sent to VP for approval". Add a small "My requests" panel showing pending/approved/rejected statuses.
- `/opportunities` (VP/Admin view): "New opportunity" dialog now includes an **Assign architect** select (required, single). Creates opp + inserts one assignment row.
- New route `/_app/requests` (VP/Admin only): table of pending requests with Approve / Reject actions. Sidebar link "Requests" with badge count for VPs.
- Dashboard: add Workload table for VP/Admin showing per-architect counts.

## Technical notes

- Approval is done via a Postgres SECURITY DEFINER function `approve_opportunity_request(_request_id)` that:
  1. Verifies caller has `vp` or `admin` role.
  2. Inserts into `opportunities` with `created_by = requested_by`.
  3. Inserts into `opportunity_architects(opportunity_id, user_id = requested_by)`.
  4. Updates request status to `approved` and stores `created_opportunity_id`.
  All in one transaction so the unique constraint and RLS are bypassed cleanly.
- Reject uses a normal UPDATE (RLS allows VP/Admin).
- Existing `opportunities` RLS stays the same — we just route architect creates through the request flow in the UI. (Insert policy remains so VPs/Admins/the SECURITY DEFINER function can still insert.)
- Single-architect: DB unique index + UI single-select.
