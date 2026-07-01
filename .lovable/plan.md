## Goal

Add client-side role gates so only teachers/school admins can reach teacher- or admin-only routes. Students and parents who hit those URLs are silently redirected to `/dashboard`.

Since no teacher/admin routes exist yet, I'll also scaffold empty landing pages so the guard is verifiable end-to-end today. Real teacher/admin features can be added under these layouts later without re-doing the auth wiring.

Backend RLS already restricts data — this change is defense-in-depth against accidentally rendering privileged UI or firing a fetch that leaks an error to a student's screen.

## Scope

- Two pathless role-gated layouts: `_teacher` (teacher OR school_admin) and `_admin` (school_admin only).
- One scaffolded route under each: `/teacher` and `/admin` — placeholder "coming soon" pages, no data fetching.
- `useAuth` gains `hasRole` / `hasAnyRole` helpers so components can also conditionally render buttons/links.
- Dashboard shows Teacher / Admin quick-access cards only when the signed-in user has the matching role.

## Blocked-access behavior

Silent redirect to `/dashboard`. No error page, no toast. Rationale: the routes are non-discoverable for non-privileged users (nav never links them there); anyone who lands there did so by URL-typing or a stale link, and bouncing to their home surface is the least confusing outcome.

## Files

New:
- `src/routes/_teacher.tsx` — pathless layout, `ssr: false`, waits for auth + roles, redirects if not teacher/school_admin, otherwise renders `<Outlet />`.
- `src/routes/_teacher.teacher.tsx` — leaf at `/teacher`, placeholder page.
- `src/routes/_admin.tsx` — same shape, requires `school_admin`.
- `src/routes/_admin.admin.tsx` — leaf at `/admin`, placeholder page.

Edited:
- `src/hooks/use-auth.ts` — add `hasRole(role)` and `hasAnyRole(roles[])`.
- `src/routes/dashboard.tsx` — conditionally show Teacher and Admin cards using `hasAnyRole` / `hasRole`.

Not touched: existing `/practice*`, `/progress`, `/bookmarks`, `/auth`, root layout, migrations, or RLS.

## Technical details

- The guards run client-side only (`ssr: false`) because Supabase session and roles are read from the browser, matching the existing `dashboard.tsx` pattern. Server-side data protection continues to rely on RLS + the `has_role` DB function.
- Guard flow inside the layout component:
  1. If `loading` → render a neutral "Loading..." screen.
  2. If not authenticated → `navigate({ to: "/auth" })`.
  3. If authenticated but missing required role → `navigate({ to: "/dashboard", replace: true })`.
  4. Otherwise → `<Outlet />`.
  Uses `useEffect` + `useNavigate`, mirroring how `dashboard.tsx` already redirects unauthenticated users, so no new router-context plumbing is needed.
- `hasRole` / `hasAnyRole` are pure functions over the existing `roles` state — no extra fetches.
- Filenames use TanStack's flat dot convention: `_teacher.tsx` is the pathless layout, `_teacher.teacher.tsx` is its child at URL `/teacher`.

## Out of scope

- Any real teacher/admin functionality (roster management, class analytics, user provisioning, etc.).
- Server-side role checks — RLS + the existing `has_role` function already enforce this at the data layer; this plan is purely a UI guard.
- Changing how roles are assigned (already fixed in the prior security migration: only student/parent are self-assignable).