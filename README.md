# KTAK V2.0 Security

Security hardening release based on V1.9.2.

Deployment order:
1. Empty test files in Storage buckets.
2. Run CLEAN_TEST_DATA.sql.
3. Run V2_0_SECURITY_PATCH.sql.
4. Configure Cloudflare Turnstile + Supabase CAPTCHA.
5. Add TURNSTILE_SITE_KEY to the existing config.js.
6. In Supabase Realtime Settings disable Allow public access.
7. Upload index.html, sw.js, manifest.webmanifest to GitHub.
8. Test pending approval / revoke / recovery / private Realtime.
9. Deploy ktak-cleanup Edge Function and Cron.

Never upload:
- sb_secret_...
- service_role
- Turnstile Secret key
- database password
