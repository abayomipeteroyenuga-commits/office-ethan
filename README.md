# ETHAN ERP & LMS

This package contains a working browser-based ERP/LMS prototype with:
- Official Ethan Digital Academy logo
- Sign in / create account
- Role-aware portals (Admin, Student, Parent, Instructor navigation)
- Student, instructor, course, LMS classroom, assignment, attendance, payments, results, certificates, announcements, reports and settings screens
- Browser-local data persistence for preview/testing
- PWA manifest and service worker
- Supabase configuration placeholder in `config.js`

## Preview admin
For local preview only, the app seeds one administrator account:
- Email: admin@ethandigitalacademy.org
- Password: EthanAdmin2026!

Change or remove this seeded preview account before a public deployment.

## Supabase
Add your project URL and publishable key in `config.js`. A production build should replace browser-local authentication/data with Supabase Auth, PostgreSQL tables, Row Level Security and Storage.

## Run locally
Open `index.html` directly, or serve this folder using a simple local web server for full PWA support.


## v2 additions
- Supabase JavaScript SDK integration layer
- Production-ready SQL schema
- Row Level Security starter policies
- User profile auto-creation trigger
- Core ERP/LMS database entities
- Backend-ready auth methods
- Setup guide included


## v3 connection
This build is configured for:
- Supabase project URL: https://hsigpjyvuvqdmujklcvw.supabase.co
- Public publishable key configured in `config.js`

Before public deployment:
- Confirm Email provider is enabled in Supabase Authentication.
- Configure the Site URL and redirect URLs for the production domain.
- Revoke/rotate any secret key that was previously exposed.

## v5 Payment-Controlled Learning Access
- New student accounts start with zero courses and zero progress.
- Registration alone never unlocks lessons/videos.
- Admin/Super Admin verifies payment and selects the exact paid course.
- Verified payment creates the student's enrolment/allocation.
- Student dashboard, courses, LMS, assignments, results and certificates no longer display sample academic history.
- Run `UPDATE-v5-PAYMENT-COURSE-GATING.sql` once in Supabase SQL Editor on an existing database.


## v6 Staff Access Upgrade

- One common email/password sign-in for all five roles: Super Admin, Admin, Instructor, Student and Parent.
- Public self-registration remains limited to Student and Parent.
- Super Admin can create Admin and Instructor accounts from Staff Management.
- Admin can create Instructor accounts only.
- Staff creation uses the protected Supabase Edge Function in `supabase/functions/create-staff/`; never place the Service Role key in `config.js`.
- New students begin with zero courses. Payment verification + course allocation controls lesson/video access.
- The old hard-coded student 4 courses / 42% progress demo dashboard was removed.

### Upgrade order from v5
1. Run `UPDATE-v6-STAFF-ACCESS.sql` once in Supabase SQL Editor.
2. Create your first Super Admin: register your own account, edit the email in `BOOTSTRAP-SUPER-ADMIN.sql`, and run it once.
3. Deploy the `create-staff` Supabase Edge Function. Supabase automatically provides its standard project environment secrets.
4. Replace the website files in GitHub with this v6 build and let Vercel redeploy.
5. Sign in as Super Admin, open Staff Management, and create Admin/Instructor accounts.
