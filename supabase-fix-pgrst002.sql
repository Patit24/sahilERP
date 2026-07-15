-- Fix Supabase REST API 503 / PGRST002:
-- {"code":"PGRST002","message":"Could not query the database for the schema cache. Retrying."}
--
-- Run this in Supabase Dashboard > SQL Editor.
-- Then wait 30-60 seconds and hard refresh the app.

-- 1. Make sure the commonly configured schemas exist.
-- If PostgREST is configured to expose a missing schema, it cannot build the cache.
create schema if not exists public;
create schema if not exists graphql_public;
create schema if not exists extensions;

-- 2. Remove any manual PostgREST schema override from the authenticator role.
-- The Dashboard Data API settings should manage exposed schemas.
alter role authenticator reset pgrst.db_schemas;
alter role authenticator reset pgrst.db_extra_search_path;

-- 3. Ensure the frontend API roles can use the public schema.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- 4. Refresh PostgREST config and schema cache.
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

-- 5. Health checks. These should return rows/results without errors.
select pg_notification_queue_usage() as notification_queue_usage;
select current_database() as database_name, current_schema() as schema_name;
