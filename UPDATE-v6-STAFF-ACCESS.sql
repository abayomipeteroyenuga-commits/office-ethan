-- ETHAN ERP & LMS v6 migration
-- Run ONCE after v5 migration.

-- Admin/Super Admin can read staff profiles through the existing profile policy.
-- This index improves staff filtering.
create index if not exists idx_profiles_role on public.profiles(role);

-- Instructors need to read course-instructor assignments involving themselves.
alter table public.course_instructors enable row level security;
drop policy if exists "course instructor assignments staff read" on public.course_instructors;
create policy "course instructor assignments staff read" on public.course_instructors
for select using (public.is_staff());

drop policy if exists "course instructor assignments admin write" on public.course_instructors;
create policy "course instructor assignments admin write" on public.course_instructors
for all using (public.is_admin()) with check (public.is_admin());
