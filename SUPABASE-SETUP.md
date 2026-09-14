# Supabase Setup for ETHAN ERP & LMS v2

1. Create a Supabase project.
2. Open SQL Editor and run `schema.sql`.
3. Open `config.js`.
4. Add:
   - `supabaseUrl`
   - `supabasePublishableKey`
5. In Authentication > Providers, enable Email.
6. Configure your Site URL and allowed redirect URLs for your deployed domain.
7. In Storage, create the buckets you need for course files, assignments, avatars and certificates.
8. Do not place the Supabase service-role key in frontend files.

When credentials are present, the app can authenticate through Supabase. Without them, it stays in browser-local preview mode.

## Existing installation upgrade to v5
If you already ran `schema.sql`, do NOT rerun the whole schema. Run only:
`UPDATE-v5-PAYMENT-COURSE-GATING.sql`

This creates missing student/parent operational rows and locks modules/lessons to paid/allocated enrolments.
