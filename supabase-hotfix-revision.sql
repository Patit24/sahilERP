create or replace function public.save_tenant_snapshot(
  p_company_id text,
  p_tenant_key text,
  p_payload jsonb,
  p_expected_revision integer,
  p_device_id text
)
returns table (
  tenant_key text,
  company_id text,
  payload jsonb,
  revision integer,
  updated_at timestamptz,
  device_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_revision integer;
begin
  if not public.can_edit_company(p_company_id) then
    raise exception 'Not authorized to edit company %', p_company_id using errcode = '42501';
  end if;

  select ts.revision
  into current_revision
  from public.tenant_snapshots ts
  where ts.company_id = p_company_id
    and ts.tenant_key = p_tenant_key
  for update;

  if current_revision is null then
    insert into public.tenant_snapshots (
      tenant_key,
      company_id,
      payload,
      device_id,
      revision,
      created_by,
      updated_by,
      updated_at
    )
    values (
      p_tenant_key,
      p_company_id,
      p_payload,
      p_device_id,
      1,
      auth.uid(),
      auth.uid(),
      now()
    );
  else
    if p_expected_revision is null or p_expected_revision <> current_revision then
      raise exception 'Snapshot conflict for %. Expected revision %, current revision %', p_tenant_key, p_expected_revision, current_revision
        using errcode = '40001';
    end if;

    update public.tenant_snapshots as ts
    set payload = p_payload,
        device_id = p_device_id,
        revision = ts.revision + 1,
        updated_by = auth.uid(),
        updated_at = now()
    where ts.company_id = p_company_id
      and ts.tenant_key = p_tenant_key;
  end if;

  insert into public.audit_logs (company_id, tenant_key, user_id, action, details)
  values (
    p_company_id,
    p_tenant_key,
    auth.uid(),
    'tenant_snapshot_saved',
    jsonb_build_object('expectedRevision', p_expected_revision)
  );

  return query
  select ts.tenant_key, ts.company_id, ts.payload, ts.revision, ts.updated_at, ts.device_id
  from public.tenant_snapshots ts
  where ts.company_id = p_company_id
    and ts.tenant_key = p_tenant_key;
end;
$$;
