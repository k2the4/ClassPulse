# ClassPulse

Secure Next.js + Supabase platform for college attendance and marks insights. Excel workbooks are parsed in the browser and discarded; only validated structured records are written to PostgreSQL.

## Run locally

1. Install Node.js 20+ and run `npm install`.
2. Create a Supabase project, copy `.env.example` to `.env.local`, and set the URL and anon key. Keep `SUPABASE_SERVICE_ROLE_KEY` out of all client code; this starter does not use it at runtime.
3. In Supabase SQL Editor, run `supabase/migrations/001_classpulse.sql`, then `supabase/seed.sql`.
4. In Authentication settings, configure your production Site URL and permitted redirect URLs. Register the intended first admin, then run:

   ```sql
   update public.profiles set role = 'admin', approval_status = 'approved'
   where email = 'admin@your-college.edu';
   ```

5. Run `npm run dev`. The admin can approve teachers, configure terms/classes/subjects/students, and create assignments.

## Deploy to Vercel

Import this folder as a Git repository in Vercel. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel project environment variables. Add the service-role key only to server-side administrative tooling if it is later introduced—never use a `NEXT_PUBLIC_` prefix. Set the Vercel URL as the Supabase Auth Site URL and redirect allow-list entry.

## Security notes

- Every application table has RLS enabled. Admins can manage all data; proctors are constrained to assigned classes; subject teachers are constrained to assigned class-subject pairs.
- Database checks reject impossible attendance and marks. The UI mirrors those checks for fast feedback.
- The upload component never sends the original workbook to storage or a server. It sends only validated rows via normal Supabase inserts.
- Test RLS with three approved accounts (admin/proctor/subject teacher) and verify that direct API reads for unrelated classes return no rows.

## Verification

Run `npm test` for spreadsheet validation and internal-mark calculation tests, then `npm run build`. Before release, manually exercise: rejected/pending sign-in redirects, unauthorized URLs, a malformed template, duplicate enrollments, marks above maximum, and mobile navigation.
