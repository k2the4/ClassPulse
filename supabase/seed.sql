-- Run after creating three Auth users in Supabase Authentication (replace emails below).
-- Bootstrap the first admin using the README command before running the rest.
insert into public.academic_terms(year,semester,active) values ('2026-27','Semester 1',true) on conflict do nothing;
insert into public.subjects(code,name) values ('CSE201','Data Structures'),('CSE202','Discrete Mathematics') on conflict do nothing;
-- Example teacher roles after the corresponding Auth users have registered:
-- update public.profiles set role='admin', approval_status='approved' where email='admin@college.edu';
-- update public.profiles set role='proctor', approval_status='approved' where email='proctor@college.edu';
-- update public.profiles set role='subject_teacher', approval_status='approved' where email='teacher@college.edu';
-- Then add a class, subjects, assignments and students through /admin/classes.
