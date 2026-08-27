# ClassPulse — Attendance & Academic Analytics Platform

A college-wide web app version of the "CLASSPULSE" Google Sheet: teachers log in,
pick a class or subject, and see the same analysis (attendance trends, midsem
performance, KPI cards, top/bottom performers, report cards) — but live,
multi-user, and backed by a real database.

## Architecture

```
College
 └─ Department (e.g. ECE)
     └─ Class (e.g. B.Tech ECE, 4th Year, Sem 7)
         └─ Section (e.g. A)
             ├─ Student (enrollment no, name, email)
             └─ Subject (e.g. Data Analysis — DA 338 T)
                 ├─ TeacherAssignment (which teacher owns this subject/section)
                 ├─ SheetLink (the Google Sheet holding raw marks/attendance)
                 └─ AnalysisSnapshot (cached computed analysis, refreshed on demand)
```

**Why cache analysis instead of recomputing from Sheets on every page load?**
Google Sheets API has per-minute quotas (default 60 read requests/min/user).
At college scale (many teachers loading dashboards concurrently) hitting the
Sheets API on every request will throttle fast. Pattern used here:
- A "Sync now" button / cron job pulls the sheet, computes analysis, stores it
  in Postgres (`AnalysisSnapshot`) with a `computedAt` timestamp.
- Dashboard pages read from the DB (fast, no quota risk) and show
  "Last synced: X min ago" with a manual refresh option.
- This still satisfies "live data" — it's live on-demand, not a hardcoded
  snapshot baked into the app.

## Stack

- **Frontend/Backend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts
- **Auth**: NextAuth.js (Credentials provider — bcrypt-hashed passwords), JWT sessions
- **Database**: PostgreSQL + Prisma ORM
- **Google Sheets access**: `googleapis` with a **service account** (share each
  subject sheet with the service account's email, read-only)
- **Deployment target**: Vercel (app) + Neon/Supabase/RDS (Postgres)

## Auth & roles

- `ADMIN` — college/department admin: creates classes, sections, subjects, assigns teachers
- `TEACHER` — logs in, sees only classes/subjects assigned to them
- Passwords stored as bcrypt hashes. Sessions are JWT, httpOnly cookies.
- (Recommended next step once this is running: switch admin-created accounts
  to invite-based signup + SSO via your college's Google Workspace, using
  NextAuth's Google provider restricted to your college domain.)

## Setup

```bash
cp .env.example .env        # fill in DATABASE_URL, NEXTAUTH_SECRET, Google service account
npm install
npx prisma migrate dev --name init
npx prisma db seed          # optional: creates a demo admin + demo class
npm run dev
```

## Google Sheets service account (needed for live sync)

1. In Google Cloud Console: create a project → enable "Google Sheets API".
2. Create a Service Account → generate a JSON key.
3. Put `client_email` and `private_key` from that JSON into `.env`
   (`GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`).
4. For every subject sheet, share it (Viewer access) with the service
   account's email — same as sharing with a person.
5. Store each sheet's ID (from its URL) in the `SheetLink` table when a
   teacher/admin adds a subject.

## What's included in this scaffold

- Prisma schema for the full data model (multi-college, multi-department ready)
- NextAuth credentials auth with bcrypt
- Google Sheets fetch + parser (`lib/googleSheets.ts`)
- Analysis engine (`lib/analysis.ts`) — ports the sheet's logic: attendance
  trend classification, KPI cards, tiering, top/bottom performer lists
- API routes for class analysis and subject analysis (read from cache, or
  trigger a live resync)
- Login page + dashboard (choose Class Analysis vs Subject Analysis) +
  class/subject analysis pages with charts

## What you still need to do to go to production

1. Run `npx prisma migrate dev` against a real Postgres instance.
2. Add your college's actual class/section/subject/teacher data (via a seed
   script or a simple admin UI you build on top of the `Admin*` API routes).
3. Share each Google Sheet with the service account.
4. Set a strong `NEXTAUTH_SECRET`, deploy behind HTTPS (Vercel handles this).
5. Decide on a sync strategy: manual "Sync now" button (included), and/or a
   scheduled job (Vercel Cron / GitHub Action) hitting `/api/analysis/sync`
   every N minutes for active subjects.
6. Add row-level access control checks (included in API routes as
   `assertTeacherOwnsSubject`) — extend for admin/department-head roles.
