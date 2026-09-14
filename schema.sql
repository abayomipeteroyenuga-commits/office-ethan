-- ETHAN ERP & LMS - Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor on a NEW/EMPTY project for the first production setup.

create extension if not exists pgcrypto;

create type public.app_role as enum ('super_admin','admin','instructor','student','parent');
create type public.record_status as enum ('active','inactive','archived');
create type public.payment_status as enum ('unpaid','part_paid','paid','overdue');
create type public.attendance_status as enum ('present','absent','late','excused');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  role public.app_role not null default 'student',
  avatar_url text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  student_no text unique not null,
  programme text,
  date_of_birth date,
  gender text,
  address text,
  registration_date date default current_date,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete cascade,
  instructor_no text unique not null,
  specialization text,
  joining_date date default current_date,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.parent_students (
  parent_id uuid references public.parents(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  relationship text default 'Guardian',
  primary key(parent_id, student_id)
);

create table public.course_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  category_id uuid references public.course_categories(id) on delete set null,
  description text default '',
  duration text,
  fee numeric(12,2) default 0 check (fee >= 0),
  difficulty text default 'Beginner',
  image_url text,
  learning_objectives text,
  prerequisites text,
  published boolean not null default false,
  certificate_enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_instructors (
  course_id uuid references public.courses(id) on delete cascade,
  instructor_id uuid references public.instructors(id) on delete cascade,
  primary key(course_id,instructor_id)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  content_html text default '',
  video_url text,
  estimated_minutes integer default 20 check (estimated_minutes > 0),
  position integer not null default 1,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'active',
  unique(student_id,course_id)
);

create table public.lesson_progress (
  student_id uuid references public.students(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  primary key(student_id,lesson_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  instructions text default '',
  max_marks numeric(8,2) default 100,
  due_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  response_text text,
  file_url text,
  submitted_at timestamptz default now(),
  score numeric(8,2),
  feedback text,
  status text default 'submitted',
  unique(assignment_id,student_id)
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  pass_mark numeric(5,2) default 60,
  time_limit_minutes integer,
  attempts_allowed integer default 1,
  published boolean default false,
  created_at timestamptz default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  question text not null,
  question_type text not null default 'mcq',
  options jsonb,
  correct_answer jsonb,
  marks numeric(6,2) default 1
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  score numeric(6,2),
  passed boolean,
  started_at timestamptz default now(),
  completed_at timestamptz
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  attendance_date date not null default current_date,
  status public.attendance_status not null default 'present',
  marked_by uuid references public.profiles(id) on delete set null,
  unique(student_id,course_id,attendance_date)
);

create table public.fees (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  course_id uuid references public.courses(id) on delete set null,
  amount numeric(12,2) not null check(amount >= 0),
  created_at timestamptz default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  student_id uuid references public.students(id) on delete cascade,
  amount_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  due_date date,
  status public.payment_status not null default 'unpaid',
  created_at timestamptz default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  student_id uuid references public.students(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  description text,
  amount numeric(12,2) not null check(amount > 0),
  method text default 'bank_transfer',
  verified boolean not null default false,
  verified_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz default now(),
  created_at timestamptz default now()
);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  assessment_name text not null,
  score numeric(6,2),
  grade text,
  status text,
  published boolean default false,
  created_at timestamptz default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_no text unique not null,
  student_id uuid references public.students(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  issued_at timestamptz default now(),
  status text default 'valid',
  verification_code text unique default encode(gen_random_bytes(8),'hex')
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  audience text default 'all',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id,first_name,last_name,email,phone,role)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name',''),
    coalesce(new.raw_user_meta_data->>'last_name',''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone',''),
    case when coalesce(new.raw_user_meta_data->>'role','student') in ('student','parent')
      then (new.raw_user_meta_data->>'role')::public.app_role
      else 'student'::public.app_role
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helper functions
create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path=public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path=public
as $$
  select coalesce(public.current_role() in ('super_admin','admin','instructor'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select coalesce(public.current_role() in ('super_admin','admin'), false)
$$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.instructors enable row level security;
alter table public.parent_students enable row level security;
alter table public.course_categories enable row level security;
alter table public.courses enable row level security;
alter table public.course_instructors enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.enrolments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.attendance enable row level security;
alter table public.fees enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.results enable row level security;
alter table public.certificates enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "profile self read" on public.profiles for select using (id=auth.uid() or public.is_staff());
create policy "profile self update" on public.profiles for update using (id=auth.uid() or public.is_admin());

create policy "public courses read" on public.courses for select using (published=true or public.is_staff());
create policy "staff courses write" on public.courses for all using (public.is_staff()) with check (public.is_staff());
create policy "public categories read" on public.course_categories for select using (true);
create policy "staff categories write" on public.course_categories for all using (public.is_staff()) with check(public.is_staff());

create policy "staff students full" on public.students for all using(public.is_staff()) with check(public.is_staff());
create policy "students read own" on public.students for select using(user_id=auth.uid());
create policy "parent linked students read" on public.students for select using (
  exists(
    select 1 from public.parent_students ps
    join public.parents p on p.id=ps.parent_id
    where ps.student_id=students.id and p.user_id=auth.uid()
  )
);

create policy "staff instructors full" on public.instructors for all using(public.is_admin()) with check(public.is_admin());
create policy "instructor read own" on public.instructors for select using(user_id=auth.uid());

create policy "staff learning structure write modules" on public.modules for all using(public.is_staff()) with check(public.is_staff());
create policy "published modules read" on public.modules for select using(public.is_staff() or exists(select 1 from public.courses c where c.id=course_id and c.published=true));
create policy "staff learning structure write lessons" on public.lessons for all using(public.is_staff()) with check(public.is_staff());
create policy "published lessons read" on public.lessons for select using(public.is_staff() or published=true);

create policy "student enrolments own read" on public.enrolments for select using (
  public.is_staff() or exists(select 1 from public.students s where s.id=student_id and s.user_id=auth.uid())
);
create policy "staff enrolments write" on public.enrolments for all using(public.is_staff()) with check(public.is_staff());

create policy "student progress own" on public.lesson_progress for all using (
  public.is_staff() or exists(select 1 from public.students s where s.id=student_id and s.user_id=auth.uid())
) with check (
  public.is_staff() or exists(select 1 from public.students s where s.id=student_id and s.user_id=auth.uid())
);

create policy "announcements read authenticated" on public.announcements for select using(auth.uid() is not null);
create policy "announcements staff write" on public.announcements for all using(public.is_staff()) with check(public.is_staff());
create policy "notifications own" on public.notifications for select using(user_id=auth.uid());
create policy "notifications own update" on public.notifications for update using(user_id=auth.uid());

create policy "staff payments full" on public.payments for all using(public.is_admin()) with check(public.is_admin());
create policy "student payments own read" on public.payments for select using(
  exists(select 1 from public.students s where s.id=student_id and s.user_id=auth.uid())
);

create policy "staff results full" on public.results for all using(public.is_staff()) with check(public.is_staff());
create policy "student results own published" on public.results for select using(
  published and exists(select 1 from public.students s where s.id=student_id and s.user_id=auth.uid())
);

create policy "certificates public verification" on public.certificates for select using(true);
create policy "certificates admin write" on public.certificates for all using(public.is_admin()) with check(public.is_admin());

create policy "audit admin read" on public.audit_logs for select using(public.is_admin());

-- Storage buckets can be created manually in Supabase Storage:
-- course-files (private), assignment-files (private), avatars (public/private as desired), certificates (private/public as desired)
