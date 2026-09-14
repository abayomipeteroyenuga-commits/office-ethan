# ETHAN ERP & LMS v8.5 — Comprehensive Audit

## Fixed
- Removed legacy demo students, instructors, payments, announcements and notifications.
- Added migration cleanup for old demo data already stored in browser localStorage.
- Student, Professional and Business Owner remain learner categories under the protected learner role.
- Learner category is now stored in Supabase auth metadata and displayed correctly after sign-in.
- Fixed global search Enter-key behavior.
- Removed Parents from the main Admin navigation for the revised learner model.
- Admin/Super Admin now hydrate real students, courses, staff and payments from Supabase.
- Instructor portal hydrates real RLS-permitted course/student data instead of fake dashboard counts.
- Student portal loads real enrolments and payment history.
- Instructor accounts are managed through secure Staff Management instead of insecure local-only creation.
- Timetable, announcements, reports and settings no longer show fake sample records.
- Reports now route to live operational modules.
- Settings Save button works locally and shows real Supabase connection status.
- Notifications now show a clean empty state when no real notification exists.
- Portal UI has been restructured for consistent hierarchy across Student, Instructor, Admin and Super Admin.
- Service worker cache bumped to v8.5.

## Important production dependency
- Staff creation requires the `create-staff` Supabase Edge Function to be deployed.
- Database actions still depend on the SQL migrations/RLS already supplied in the project.

## Additional reliability checks
- JavaScript syntax validated with Node for both app.js and supabase-client.js.
- ZIP integrity and local asset references checked.
- Payment allocation now blocks cleanly if no learner or course exists.
- Course creation now writes to Supabase when connected instead of disappearing on refresh.
- Announcements now read/write Supabase when connected.
- Signed-in notification panel can load the user's real notifications.
- Admin learner list is aligned with the self-registration model; no insecure duplicate local account creation.
