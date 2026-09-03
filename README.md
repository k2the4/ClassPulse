# ClassPulse — Attendance & Academic Analytics Platform

ClassPulse is a college-wide attendance and academic analytics application for teachers. The application reads its structured academic data from one PostgreSQL database and uses Google Sheets only as the raw attendance/marks source where configured.

## Architecture

```text
Supabase
├─ Auth
│  └─ email/password credentials
└─ PostgreSQL
   └─ ClassPulse application tables
      └─ accessed by the Next.js backend through Prisma

Google Sheets
└─ raw attendance / marks source for analysis syncs
```

There is one application database: the PostgreSQL database belonging to the ClassPulse Supabase project. Prisma is the ORM used by the Next.js backend to access that database. Supabase Auth is the single authority for user passwords and identities.

The current Pages Router still uses NextAuth as a session bridge around the Supabase credential check. NextAuth does not store passwords or application user records; Supabase Auth owns credentials, while Prisma owns the ClassPulse user/profile and academic data.

## Data model

```text
College
 └─ Department
     └─ Class
         └─ Section
             ├─ Student
             └─ Subject
                 ├─ Assignment → User
                 ├─ SheetLink
                 └─ AnalysisSnapshot

User
 ├─ Assignment
 ├─ ClassAccess
 ├─ Proctored classes
 └─ AttendanceSession
```

A subject assignment identifies the single teacher responsible for a class/section subject. ClassAccess is separate and grants whole-class visibility. This allows multiple teachers to have access to the same class while keeping each exact class+subject assignment unique.

## Stack

- Next.js 14 / TypeScript
- Tailwind CSS / Recharts
- Supabase Auth
- Supabase PostgreSQL
- Prisma ORM
- Google Sheets API via a service account

## Authentication

Teacher and admin accounts exist in both systems for different purposes:

- Supabase Auth stores the actual email/password credential.
- Prisma `User` stores the ClassPulse application profile, role, college and authorization relationships.
- `User.authUserId` links the Prisma user to the corresponding Supabase Auth user.
- Password hashes are not stored in Prisma.

To provision the current Prisma users in Supabase Auth, configure `SUPABASE_SERVICE_ROLE_KEY` and run:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run auth:sync
```

The sync utility creates missing Supabase Auth users, confirms their emails, sets the configured demo password, and links their Supabase Auth IDs back to Prisma. Set `CLASS_PULSE_DEFAULT_PASSWORD` before running it if you do not want the demo default.

## Environment

Copy `.env.example` to `.env.local` and configure:

```text
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXTAUTH_SECRET
GOOGLE_SA_EMAIL
GOOGLE_SA_PRIVATE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed to client code.

## Prisma

Prisma migrations are the source of truth for the ClassPulse application schema. Run migrations with:

```bash
npx prisma migrate deploy
```

For local development:

```bash
npm run dev
```

Prisma Studio:

```bash
npm run prisma:studio
```

## Google Sheets

The Google Sheets service account is used only when a ClassPulse `SheetLink` is configured for a section or subject. Share the relevant sheet with the service account email and store its sheet ID in PostgreSQL through Prisma-backed application functionality.

## Important rule

Do not add a second application database or a second password store. New teachers, classes, subjects, assignments, class access, students, attendance sessions and analysis snapshots belong in the Prisma schema/database. Authentication belongs in Supabase Auth.
