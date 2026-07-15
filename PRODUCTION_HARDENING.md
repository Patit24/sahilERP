# SK TRADERS Production Hardening Checklist

Use this checklist before using the ERP as a company system of record.

## Required Environment

- `VITE_ENABLE_SUPABASE_AUTH=true`
- `VITE_ENABLE_REMOTE_STORAGE=true`
- `VITE_DISABLE_LOCAL_CACHE=true` on shared or production devices
- No Supabase `secret`, `service_role`, or database password in frontend env files
- Rotate any secret key that was ever pasted into chat or logs

## Supabase Database

- Run the latest `supabase-setup.sql`
- Confirm RLS is enabled on:
  - `tenant_snapshots`
  - `company_members`
  - `app_user_profiles`
  - `audit_logs`
  - all `erp_*` tables
- Confirm no `anon` policies exist on financial tables
- Create Supabase Auth users from the dashboard or a trusted server/Edge Function
- Promote the owner manually:

```sql
update public.app_user_profiles
set role = 'master_admin', is_active = true
where email = 'owner@example.com';
```

- Add company membership:

```sql
insert into public.company_members (company_id, user_id, role)
select 'sk_traders', id, 'owner'
from auth.users
where email = 'owner@example.com'
on conflict (company_id, user_id)
do update set role = 'owner', is_active = true;
```

## Backups And Recovery

- Enable Supabase daily backups
- Export a manual database backup before every schema change
- Test restore into a staging Supabase project monthly
- Keep local JSON backups only as emergency imports, not as the primary backup system
- Document who can restore data and require approval for restore

## Monitoring

- Enable Supabase logs and alerts for:
  - authentication failures
  - RLS denied operations
  - RPC errors
  - unusually high write volume
- Add frontend error tracking before production launch
- Review `audit_logs` weekly during pilot

## Rate Limits And Abuse Protection

- Disable public signup unless intentionally needed
- Prefer invited users only
- Configure Supabase Auth rate limits
- Restrict production deployment domains in Supabase Auth URL settings
- Use HTTPS-only hosting

## Accounting Workflow Tests

- Run before every deployment:

```bash
npm test
npm run build
npm audit --audit-level=low
```

- Manually verify:
  - purchase invoice create/edit/delete
  - supplier payment FIFO allocation
  - sales invoice create/edit/delete
  - customer payment entry
  - cash/bank voucher entry
  - backup export
  - restricted agent view-only permissions
  - concurrent edit conflict reload

## Go/No-Go

Do not go live if any of these are true:

- Any financial table has an anonymous read/write policy
- Owner cannot restore from backup in staging
- Agent can edit a module marked view-only
- Two-device concurrent edits silently overwrite each other
- `npm test`, `npm run build`, or `npm audit --audit-level=low` fails
