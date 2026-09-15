-- Ethan ERP/LMS v9.3 Super Admin role verification
-- Run in Supabase SQL Editor.

-- 1. Confirm Authentication user and profile row match by UUID.
select
  u.id as auth_user_id,
  u.email as auth_email,
  p.id as profile_id,
  p.email as profile_email,
  p.role
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('fedora4jesus@gmail.com');

-- 2. Enforce the intended database role on the profile belonging to THIS auth user.
update public.profiles p
set role = 'super_admin',
    email = 'fedora4jesus@gmail.com'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('fedora4jesus@gmail.com');

-- 3. Verify.
select
  u.id as auth_user_id,
  u.email,
  p.id as profile_id,
  p.role
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) = lower('fedora4jesus@gmail.com');
