-- Run after 002. Adds the selected department sections and safe admin deletion.
drop function if exists public.create_my_class(text,text,text,public.app_role);
create or replace function public.create_my_class(p_batch text,p_branch text,p_section text,p_subject_code text,p_assignment_role public.app_role) returns uuid language plpgsql security definer set search_path = public as $$
declare v_term_id uuid; v_subject_id uuid; v_class_id uuid; v_year text; v_subject_name text;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and approval_status='approved') then raise exception 'Only approved teachers can add a class'; end if;
  if p_batch not in ('2023-2027','2024-2028','2025-2029','2026-2030') or p_branch not in ('CSE','IT','ECE','EEE') then raise exception 'Choose a listed session and branch'; end if;
  if (p_branch='CSE' and p_section not in ('1','2','3','Evening')) or (p_branch in ('IT','ECE') and p_section not in ('1','2','Evening')) or (p_branch='EEE' and p_section<>'General') then raise exception 'Choose a valid section for the selected branch'; end if;
  if p_assignment_role not in ('proctor','subject_teacher') then raise exception 'Choose proctor or subject teacher'; end if;
  if p_batch <> '2023-2027' or p_branch <> 'ECE' then raise exception 'Subject setup is currently available only for ECE 2023-2027'; end if;
  v_year := '4'; v_subject_name := case p_subject_code when 'PME' then 'Professional Management Ethics' when 'UHV' then 'Universal Human Values' when 'OPSC' then 'Open Source and Cloud Computing' when 'AI' then 'Artificial Intelligence' when 'ML' then 'Machine Learning' when 'DA' then 'Data Analytics' when 'SSMDA' then 'Statistical and Stochastic Methods for Data Analytics' when 'NSS' then 'National Service Scheme' when 'OPSC Lab' then 'OPSC Lab' when 'AI Lab' then 'AI Lab' when 'ML Lab' then 'ML Lab' when 'DA Lab' then 'DA Lab' when 'SSMDA Lab' then 'SSMDA Lab' else null end;
  if v_subject_name is null then raise exception 'Choose a configured subject'; end if;
  insert into public.academic_terms(year,semester,active) values('2026-2027','7',true) on conflict(year,semester) do update set active=true returning id into v_term_id;
  insert into public.subjects(code,name) values(p_subject_code,v_subject_name) on conflict(code) do update set name=excluded.name returning id into v_subject_id;
  insert into public.classes(academic_term_id,branch,batch,year,section) values(v_term_id,p_branch,p_batch,v_year,p_section) on conflict(academic_term_id,branch,batch,year,section) do update set branch=excluded.branch returning id into v_class_id;
  insert into public.class_subjects(class_id,subject_id) values(v_class_id,v_subject_id) on conflict(class_id,subject_id) do nothing;
  if p_assignment_role='proctor' then insert into public.teacher_assignments(teacher_id,class_id,subject_id,assignment_role) select auth.uid(),v_class_id,null,'proctor' where not exists(select 1 from public.teacher_assignments where teacher_id=auth.uid() and class_id=v_class_id and assignment_role='proctor'); else insert into public.teacher_assignments(teacher_id,class_id,subject_id,assignment_role) select auth.uid(),v_class_id,v_subject_id,'subject_teacher' where not exists(select 1 from public.teacher_assignments where teacher_id=auth.uid() and class_id=v_class_id and subject_id=v_subject_id and assignment_role='subject_teacher'); end if;
  return v_class_id;
end; $$;
create or replace function public.delete_class_as_admin(p_class_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not public.is_admin() then raise exception 'Only admins can delete classes'; end if; delete from public.classes where id=p_class_id; end; $$;
revoke all on function public.create_my_class(text,text,text,text,public.app_role), public.delete_class_as_admin(uuid) from public;
grant execute on function public.create_my_class(text,text,text,text,public.app_role), public.delete_class_as_admin(uuid) to authenticated;
