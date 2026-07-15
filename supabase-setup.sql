create table if not exists public.tenant_snapshots (
  tenant_key text primary key,
  company_id text not null default 'sk_traders',
  payload jsonb not null default '{}'::jsonb,
  device_id text,
  revision integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.tenant_snapshots add column if not exists company_id text not null default 'sk_traders';
alter table public.tenant_snapshots add column if not exists revision integer not null default 1;
alter table public.tenant_snapshots add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.tenant_snapshots add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.tenant_snapshots enable row level security;

-- Production lockdown:
-- No anonymous client may read, insert, update, or delete tenant snapshots.
-- Leave this table without permissive anon policies until Supabase Auth,
-- company membership, and auth.uid()-scoped RLS policies are added.
drop policy if exists "tenant_snapshots_anon_select" on public.tenant_snapshots;
drop policy if exists "tenant_snapshots_anon_insert" on public.tenant_snapshots;
drop policy if exists "tenant_snapshots_anon_update" on public.tenant_snapshots;
drop policy if exists "tenant_snapshots_anon_delete" on public.tenant_snapshots;

-- Drop any previous broad authenticated prototype policies too.
drop policy if exists "tenant_snapshots_authenticated_select" on public.tenant_snapshots;
drop policy if exists "tenant_snapshots_authenticated_insert" on public.tenant_snapshots;
drop policy if exists "tenant_snapshots_authenticated_update" on public.tenant_snapshots;
drop policy if exists "tenant_snapshots_authenticated_delete" on public.tenant_snapshots;
drop policy if exists "tenant_snapshots_company_member_select" on public.tenant_snapshots;

do $$
begin
  alter publication supabase_realtime add table public.tenant_snapshots;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.company_members (
  company_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'agent' check (role in ('owner', 'admin', 'agent')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

alter table public.company_members enable row level security;

create table if not exists public.app_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'agent' check (role in ('master_admin', 'agent')),
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_user_profiles enable row level security;

create or replace function public.is_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_user_profiles
    where id = auth.uid()
      and role = 'master_admin'
      and is_active = true
  );
$$;

create or replace function public.is_company_member(target_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_master_admin()
    or exists (
      select 1
      from public.company_members
      where company_id = target_company_id
        and user_id = auth.uid()
        and is_active = true
    );
$$;

create or replace function public.can_edit_company(target_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_master_admin()
    or exists (
      select 1
      from public.company_members
      where company_id = target_company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
        and is_active = true
    );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
begin
  insert into public.app_user_profiles (
    id,
    email,
    display_name,
    role,
    permissions
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    'agent',
    '{}'::jsonb
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_app_profile on auth.users;
create trigger on_auth_user_created_create_app_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop policy if exists "app_user_profiles_self_select" on public.app_user_profiles;
create policy "app_user_profiles_self_select"
on public.app_user_profiles
for select
to authenticated
using (id = auth.uid() or public.is_master_admin());

drop policy if exists "app_user_profiles_master_update" on public.app_user_profiles;
create policy "app_user_profiles_master_update"
on public.app_user_profiles
for update
to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

drop policy if exists "company_members_self_or_master_select" on public.company_members;
create policy "company_members_self_or_master_select"
on public.company_members
for select
to authenticated
using (user_id = auth.uid() or public.is_master_admin());

drop policy if exists "company_members_master_write" on public.company_members;
create policy "company_members_master_write"
on public.company_members
for all
to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

create policy "tenant_snapshots_company_member_select"
on public.tenant_snapshots
for select
to authenticated
using (public.is_company_member(company_id));

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id text,
  tenant_key text,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_company_member_select" on public.audit_logs;
create policy "audit_logs_company_member_select"
on public.audit_logs
for select
to authenticated
using (company_id is null or public.is_company_member(company_id));

create or replace function public.append_audit_log(
  p_company_id text,
  p_tenant_key text,
  p_action text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_company_id is not null and not public.is_company_member(p_company_id) then
    raise exception 'Not authorized for company %', p_company_id using errcode = '42501';
  end if;

  insert into public.audit_logs (company_id, tenant_key, user_id, action, details)
  values (p_company_id, p_tenant_key, auth.uid(), p_action, coalesce(p_details, '{}'::jsonb));
end;
$$;

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

-- Bootstrap the first master admin manually after creating the Auth user:
-- update public.app_user_profiles
-- set role = 'master_admin', is_active = true
-- where email = 'owner@example.com';
--
-- Then add the owner to each company they can access:
-- insert into public.company_members (company_id, user_id, role)
-- select 'sk_traders', id, 'owner'
-- from auth.users
-- where email = 'owner@example.com'
-- on conflict (company_id, user_id) do update set role = 'owner', is_active = true;

create table if not exists public.erp_suppliers (
  company_id text not null,
  id text not null,
  name text not null,
  opening_balance numeric not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_customers (
  company_id text not null,
  id text not null,
  name text not null,
  email text,
  phone text,
  opening_balance numeric not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_items (
  company_id text not null,
  id text not null,
  name text not null,
  unit text not null,
  opening_stock numeric not null default 0,
  opening_value numeric not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_purchase_invoices (
  company_id text not null,
  id text not null,
  supplier_id text not null,
  invoice_no text not null,
  invoice_date date not null,
  fy text not null,
  quantity_mt numeric not null default 0,
  invoice_amount numeric not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_supplier_payments (
  company_id text not null,
  id text not null,
  supplier_id text not null,
  payment_date date not null,
  fy text not null,
  amount numeric not null default 0,
  is_advance boolean not null default false,
  booking_mt numeric not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_sales_invoices (
  company_id text not null,
  id text not null,
  customer_id text not null,
  invoice_no text not null,
  invoice_date date not null,
  fy text not null,
  quantity_mt numeric not null default 0,
  invoice_amount numeric not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_customer_payments (
  company_id text not null,
  id text not null,
  customer_id text not null,
  payment_date date not null,
  fy text not null,
  amount numeric not null default 0,
  counter_id text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_expense_types (
  company_id text not null,
  id text not null,
  name text not null,
  link_type text not null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_expense_entries (
  company_id text not null,
  id text not null,
  expense_type_id text not null,
  supplier_id text,
  expense_date date not null,
  fy text not null,
  amount numeric not null default 0,
  linked_invoice_id text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_fixed_schemes (
  company_id text not null,
  id text not null,
  supplier_id text not null,
  scheme_name text not null,
  rate_per_mt numeric not null default 0,
  from_date date not null,
  to_date date not null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_mt_bookings (
  company_id text not null,
  id text not null,
  supplier_id text not null,
  order_date date not null,
  consume_start_date date not null,
  fy text not null,
  booked_mt numeric not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_received_discounts (
  company_id text not null,
  id text not null,
  supplier_id text not null,
  discount_received_date date not null,
  fy text not null,
  amount numeric not null default 0,
  type text not null,
  status text not null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

do $$
declare
  erp_table text;
begin
  foreach erp_table in array array[
    'erp_suppliers',
    'erp_customers',
    'erp_items',
    'erp_purchase_invoices',
    'erp_supplier_payments',
    'erp_sales_invoices',
    'erp_customer_payments',
    'erp_expense_types',
    'erp_expense_entries',
    'erp_fixed_schemes',
    'erp_mt_bookings',
    'erp_received_discounts'
  ]
  loop
    execute format('alter table public.%I enable row level security', erp_table);
    execute format('drop policy if exists %I on public.%I', erp_table || '_select', erp_table);
    execute format('drop policy if exists %I on public.%I', erp_table || '_write', erp_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_company_member(company_id))',
      erp_table || '_select',
      erp_table
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.can_edit_company(company_id)) with check (public.can_edit_company(company_id))',
      erp_table || '_write',
      erp_table
    );
  end loop;
end $$;

create or replace function public.audit_erp_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_company_id text;
  changed_id text;
begin
  if TG_OP = 'DELETE' then
    changed_company_id := old.company_id;
    changed_id := old.id;
  else
    changed_company_id := new.company_id;
    changed_id := new.id;
  end if;

  insert into public.audit_logs (company_id, tenant_key, user_id, action, details)
  values (
    changed_company_id,
    null,
    auth.uid(),
    TG_TABLE_NAME || '_' || lower(TG_OP),
    jsonb_build_object('recordId', changed_id)
  );

  if TG_OP = 'DELETE' then
    return old;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  erp_table text;
begin
  foreach erp_table in array array[
    'erp_suppliers',
    'erp_customers',
    'erp_items',
    'erp_purchase_invoices',
    'erp_supplier_payments',
    'erp_sales_invoices',
    'erp_customer_payments',
    'erp_expense_types',
    'erp_expense_entries',
    'erp_fixed_schemes',
    'erp_mt_bookings',
    'erp_received_discounts'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || erp_table || '_change', erp_table);
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function public.audit_erp_row_change()',
      'audit_' || erp_table || '_change',
      erp_table
    );
  end loop;
end $$;

create or replace function public.sync_relational_tenant(
  p_company_id text,
  p_fy text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_company(p_company_id) then
    raise exception 'Not authorized to edit company %', p_company_id using errcode = '42501';
  end if;

  delete from public.erp_suppliers where company_id = p_company_id;
  insert into public.erp_suppliers (company_id, id, name, opening_balance, raw_data)
  select p_company_id, item->>'id', coalesce(item->>'name', ''), coalesce((item->>'openingBalance')::numeric, 0), item
  from jsonb_array_elements(coalesce(p_payload->'suppliers', '[]'::jsonb)) item
  where item ? 'id';

  delete from public.erp_customers where company_id = p_company_id;
  insert into public.erp_customers (company_id, id, name, email, phone, opening_balance, raw_data)
  select p_company_id, item->>'id', coalesce(item->>'name', ''), item->>'email', item->>'phone', coalesce((item->>'openingBalance')::numeric, 0), item
  from jsonb_array_elements(coalesce(p_payload->'customers', '[]'::jsonb)) item
  where item ? 'id';

  delete from public.erp_items where company_id = p_company_id;
  insert into public.erp_items (company_id, id, name, unit, opening_stock, opening_value, raw_data)
  select p_company_id, item->>'id', coalesce(item->>'name', ''), coalesce(item->>'unit', 'MT'), coalesce((item->>'openingStock')::numeric, 0), coalesce((item->>'openingValue')::numeric, 0), item
  from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) item
  where item ? 'id';

  delete from public.erp_purchase_invoices where company_id = p_company_id and fy = p_fy;
  insert into public.erp_purchase_invoices (company_id, id, supplier_id, invoice_no, invoice_date, fy, quantity_mt, invoice_amount, raw_data)
  select p_company_id, item->>'id', item->>'supplierId', coalesce(item->>'invoiceNo', ''), (item->>'invoiceDate')::date, coalesce(item->>'fy', p_fy), coalesce((item->>'quantityMT')::numeric, 0), coalesce((item->>'invoiceAmount')::numeric, 0), item
  from jsonb_array_elements(coalesce(p_payload->'invoices', '[]'::jsonb)) item
  where item ? 'id' and item ? 'supplierId' and item ? 'invoiceDate';

  delete from public.erp_supplier_payments where company_id = p_company_id and fy = p_fy;
  insert into public.erp_supplier_payments (company_id, id, supplier_id, payment_date, fy, amount, is_advance, booking_mt, raw_data)
  select p_company_id, item->>'id', item->>'supplierId', (item->>'paymentDate')::date, coalesce(item->>'fy', p_fy), coalesce((item->>'amount')::numeric, 0), coalesce((item->>'isAdvance')::boolean, false), coalesce((item->>'bookingMT')::numeric, 0), item
  from jsonb_array_elements(coalesce(p_payload->'payments', '[]'::jsonb)) item
  where item ? 'id' and item ? 'supplierId' and item ? 'paymentDate';

  delete from public.erp_sales_invoices where company_id = p_company_id and fy = p_fy;
  insert into public.erp_sales_invoices (company_id, id, customer_id, invoice_no, invoice_date, fy, quantity_mt, invoice_amount, raw_data)
  select p_company_id, item->>'id', item->>'customerId', coalesce(item->>'invoiceNo', ''), (item->>'invoiceDate')::date, coalesce(item->>'fy', p_fy), coalesce((item->>'quantityMT')::numeric, 0), coalesce((item->>'invoiceAmount')::numeric, 0), item
  from jsonb_array_elements(coalesce(p_payload->'salesInvoices', '[]'::jsonb)) item
  where item ? 'id' and item ? 'customerId' and item ? 'invoiceDate';

  delete from public.erp_customer_payments where company_id = p_company_id and fy = p_fy;
  insert into public.erp_customer_payments (company_id, id, customer_id, payment_date, fy, amount, counter_id, raw_data)
  select p_company_id, item->>'id', item->>'customerId', (item->>'paymentDate')::date, coalesce(item->>'fy', p_fy), coalesce((item->>'amount')::numeric, 0), item->>'counterId', item
  from jsonb_array_elements(coalesce(p_payload->'customerPayments', '[]'::jsonb)) item
  where item ? 'id' and item ? 'customerId' and item ? 'paymentDate';

  delete from public.erp_expense_types where company_id = p_company_id;
  insert into public.erp_expense_types (company_id, id, name, link_type, raw_data)
  select p_company_id, item->>'id', coalesce(item->>'name', ''), coalesce(item->>'linkType', 'netprofit'), item
  from jsonb_array_elements(coalesce(p_payload->'expenseTypes', '[]'::jsonb)) item
  where item ? 'id';

  delete from public.erp_expense_entries where company_id = p_company_id and fy = p_fy;
  insert into public.erp_expense_entries (company_id, id, expense_type_id, supplier_id, expense_date, fy, amount, linked_invoice_id, raw_data)
  select p_company_id, item->>'id', item->>'expenseTypeId', item->>'supplierId', (item->>'expenseDate')::date, coalesce(item->>'fy', p_fy), coalesce((item->>'amount')::numeric, 0), item->>'linkedInvoiceId', item
  from jsonb_array_elements(coalesce(p_payload->'expenseEntries', '[]'::jsonb)) item
  where item ? 'id' and item ? 'expenseTypeId' and item ? 'expenseDate';

  delete from public.erp_fixed_schemes where company_id = p_company_id;
  insert into public.erp_fixed_schemes (company_id, id, supplier_id, scheme_name, rate_per_mt, from_date, to_date, raw_data)
  select p_company_id, item->>'id', item->>'supplierId', coalesce(item->>'schemeName', ''), coalesce((item->>'ratePerMT')::numeric, 0), (item->>'fromDate')::date, (item->>'toDate')::date, item
  from jsonb_array_elements(coalesce(p_payload->'fixedSchemes', '[]'::jsonb)) item
  where item ? 'id' and item ? 'supplierId' and item ? 'fromDate' and item ? 'toDate';

  delete from public.erp_mt_bookings where company_id = p_company_id and fy = p_fy;
  insert into public.erp_mt_bookings (company_id, id, supplier_id, order_date, consume_start_date, fy, booked_mt, raw_data)
  select p_company_id, item->>'id', item->>'supplierId', (item->>'orderDate')::date, (item->>'consumeStartDate')::date, coalesce(item->>'fy', p_fy), coalesce((item->>'bookedMT')::numeric, 0), item
  from jsonb_array_elements(coalesce(p_payload->'mtBookings', '[]'::jsonb)) item
  where item ? 'id' and item ? 'supplierId' and item ? 'orderDate' and item ? 'consumeStartDate';

  delete from public.erp_received_discounts where company_id = p_company_id and fy = p_fy;
  insert into public.erp_received_discounts (company_id, id, supplier_id, discount_received_date, fy, amount, type, status, raw_data)
  select p_company_id, item->>'id', item->>'supplierId', (item->>'discountReceivedDate')::date, coalesce(item->>'fy', p_fy), coalesce((item->>'amount')::numeric, 0), coalesce(item->>'type', 'wallet'), coalesce(item->>'status', 'Allocated'), item
  from jsonb_array_elements(coalesce(p_payload->'receivedDiscounts', '[]'::jsonb)) item
  where item ? 'id' and item ? 'supplierId' and item ? 'discountReceivedDate';

  insert into public.audit_logs (company_id, tenant_key, user_id, action, details)
  values (p_company_id, null, auth.uid(), 'relational_tenant_synced', jsonb_build_object('fy', p_fy));
end;
$$;
