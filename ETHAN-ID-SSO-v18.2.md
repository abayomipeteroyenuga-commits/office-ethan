# Ethan Office v18.2 — Ethan ID Connected
Accepts the existing Ethan Hub short-lived SSO ticket using target `office`, exchanges it through the deployed `ethan-sso` Supabase Edge Function, establishes the same Supabase user session, and removes the ticket from the URL. Existing Office functionality is preserved.
