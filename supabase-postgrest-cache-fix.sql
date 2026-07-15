-- Fix Supabase REST API 503 / PGRST002 schema-cache errors.
-- Run this in Supabase SQL Editor.
--
-- Expected browser/API error:
-- {"code":"PGRST002","message":"Could not query the database for the schema cache. Retrying."}

select pg_notification_queue_usage();

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
