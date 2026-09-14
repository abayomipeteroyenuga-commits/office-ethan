-- FIRST SUPER ADMIN SETUP
-- 1. First create your own account normally from the website using your real email.
-- 2. Replace YOUR-EMAIL@example.com below with that exact email.
-- 3. Run this ONCE in Supabase SQL Editor.
-- 4. Sign out and sign back in. You will enter the Super Admin portal.

update public.profiles
set role = 'super_admin'
where lower(email) = lower('YOUR-EMAIL@example.com');

-- Remove the temporary student operational record created during public registration.
delete from public.students
where user_id in (
  select id from public.profiles where lower(email) = lower('YOUR-EMAIL@example.com') and role='super_admin'
);
