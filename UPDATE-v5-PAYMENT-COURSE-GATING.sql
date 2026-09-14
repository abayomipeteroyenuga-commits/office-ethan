-- ETHAN ERP & LMS v5 migration
-- Run ONCE in Supabase SQL Editor after the original schema.sql has already been installed.

-- 1) Future student/parent registrations get the corresponding operational record automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  selected_role public.app_role;
begin
  selected_role := case
    when coalesce(new.raw_user_meta_data->>'role','student') in ('student','parent')
      then (new.raw_user_meta_data->>'role')::public.app_role
    else 'student'::public.app_role
  end;

  insert into public.profiles(id,first_name,last_name,email,phone,role)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name',''),
    coalesce(new.raw_user_meta_data->>'last_name',''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone',''),
    selected_role
  )
  on conflict (id) do nothing;

  if selected_role = 'student' then
    insert into public.students(user_id,student_no,status)
    values(new.id, 'EDA-ST-' || upper(substr(replace(new.id::text,'-',''),1,8)), 'Pending Payment')
    on conflict (user_id) do nothing;
  elsif selected_role = 'parent' then
    insert into public.parents(user_id)
    values(new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- 2) Backfill student operational records for users who registered before v5.
insert into public.students(user_id,student_no,status)
select p.id, 'EDA-ST-' || upper(substr(replace(p.id::text,'-',''),1,8)), 'Pending Payment'
from public.profiles p
where p.role='student'
and not exists (select 1 from public.students s where s.user_id=p.id);

-- 3) Backfill parent operational records.
insert into public.parents(user_id)
select p.id
from public.profiles p
where p.role='parent'
and not exists (select 1 from public.parents pr where pr.user_id=p.id);

-- 4) Learning structure is visible to staff or students enrolled in the relevant course.
drop policy if exists "published modules read" on public.modules;
create policy "allocated modules read" on public.modules for select using (
  public.is_staff()
  or exists (
    select 1 from public.enrolments e
    join public.students s on s.id=e.student_id
    where e.course_id=modules.course_id
      and e.status='active'
      and s.user_id=auth.uid()
  )
);

drop policy if exists "published lessons read" on public.lessons;
create policy "allocated lessons read" on public.lessons for select using (
  public.is_staff()
  or exists (
    select 1
    from public.modules m
    join public.enrolments e on e.course_id=m.course_id and e.status='active'
    join public.students s on s.id=e.student_id
    where m.id=lessons.module_id
      and s.user_id=auth.uid()
      and lessons.published=true
  )
);

-- 5) Course catalogue can remain visible, but enrolment is the authorization gate for lessons/videos.
-- Admin/Super Admin already have write access to payments and enrolments through the original RLS policies.
