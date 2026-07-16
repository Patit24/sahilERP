-- Fix login/profile timeouts caused by RLS-filtered direct reads of app_user_profiles.
-- Run this in Supabase Dashboard > SQL Editor.
--
-- The app now calls this RPC first when loading the signed-in user's profile.
-- It is SECURITY DEFINER, so it can read the current user's profile without
-- recursively evaluating app_user_profiles SELECT policies.

create or replace function public.get_my_app_user_profile()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  permissions jsonb,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.email,
    p.display_name,
    p.role,
    p.permissions,
    p.is_active,
    p.created_at,
    p.updated_at
  from public.app_user_profiles p
  where p.id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_my_app_user_profile() to authenticated;

-- Make normal self-select simpler. Master-admin list access should be handled
-- through trusted RPC/server functions instead of recursively checking the same table.
drop policy if exists "app_user_profiles_self_select" on public.app_user_profiles;
create policy "app_user_profiles_self_select"
on public.app_user_profiles
for select
to authenticated
using (id = auth.uid());

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
