-- Long-term ERP relational storage migration.
-- Run this once in the Supabase SQL Editor as the postgres role.
-- It keeps tenant_snapshots as a legacy fallback, but moves live ERP data into rows.

create table if not exists public.erp_suppliers (
  company_id text not null,
  id text not null,
  name text not null,
  phone text,
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
  category text,
  item_code text,
  purchase_price numeric not null default 0,
  sales_price numeric not null default 0,
  gst_rate numeric,
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
  additional_cost numeric not null default 0,
  amount_paid numeric not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_purchase_invoice_items (
  company_id text not null,
  invoice_id text not null,
  line_no integer not null,
  item_id text not null,
  quantity_mt numeric not null default 0,
  basic_rate numeric not null default 0,
  rate numeric not null default 0,
  amount numeric not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, invoice_id, line_no)
);

create table if not exists public.erp_supplier_payments (
  company_id text not null,
  id text not null,
  supplier_id text not null,
  payment_date date not null,
  fy text not null,
  amount numeric not null default 0,
  payment_mode text,
  is_advance boolean not null default false,
  booking_mt numeric not null default 0,
  booking_market_rate numeric,
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
  additional_cost numeric not null default 0,
  amount_received numeric not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.erp_sales_invoice_items (
  company_id text not null,
  invoice_id text not null,
  line_no integer not null,
  item_id text not null,
  quantity_mt numeric not null default 0,
  basic_rate numeric not null default 0,
  rate numeric not null default 0,
  amount numeric not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, invoice_id, line_no)
);

create table if not exists public.erp_customer_payments (
  company_id text not null,
  id text not null,
  customer_id text not null,
  payment_date date not null,
  fy text not null,
  amount numeric not null default 0,
  payment_mode text,
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
  payment_mode text,
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
  booked_market_rate numeric,
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

-- Keep the migration idempotent when earlier relational drafts already created
-- narrower tables. CREATE TABLE IF NOT EXISTS will not add missing columns.
alter table public.erp_suppliers add column if not exists phone text;
alter table public.erp_items add column if not exists category text;
alter table public.erp_items add column if not exists item_code text;
alter table public.erp_items add column if not exists purchase_price numeric not null default 0;
alter table public.erp_items add column if not exists sales_price numeric not null default 0;
alter table public.erp_items add column if not exists gst_rate numeric;
alter table public.erp_purchase_invoices add column if not exists additional_cost numeric not null default 0;
alter table public.erp_purchase_invoices add column if not exists amount_paid numeric not null default 0;
alter table public.erp_supplier_payments add column if not exists payment_mode text;
alter table public.erp_supplier_payments add column if not exists booking_market_rate numeric;
alter table public.erp_sales_invoices add column if not exists additional_cost numeric not null default 0;
alter table public.erp_sales_invoices add column if not exists amount_received numeric not null default 0;
alter table public.erp_customer_payments add column if not exists payment_mode text;
alter table public.erp_expense_entries add column if not exists payment_mode text;
alter table public.erp_mt_bookings add column if not exists booked_market_rate numeric;

create index if not exists erp_purchase_invoices_company_fy_idx on public.erp_purchase_invoices (company_id, fy, invoice_date desc);
create index if not exists erp_purchase_invoice_items_invoice_idx on public.erp_purchase_invoice_items (company_id, invoice_id);
create index if not exists erp_supplier_payments_company_fy_idx on public.erp_supplier_payments (company_id, fy, payment_date desc);
create index if not exists erp_sales_invoices_company_fy_idx on public.erp_sales_invoices (company_id, fy, invoice_date desc);
create index if not exists erp_sales_invoice_items_invoice_idx on public.erp_sales_invoice_items (company_id, invoice_id);
create index if not exists erp_customer_payments_company_fy_idx on public.erp_customer_payments (company_id, fy, payment_date desc);

do $$
declare
  erp_table text;
begin
  foreach erp_table in array array[
    'erp_suppliers',
    'erp_customers',
    'erp_items',
    'erp_purchase_invoices',
    'erp_purchase_invoice_items',
    'erp_supplier_payments',
    'erp_sales_invoices',
    'erp_sales_invoice_items',
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

create or replace function public.can_maintain_erp_schema()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or current_user in ('postgres', 'service_role', 'supabase_admin');
$$;

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
  if not (public.can_maintain_erp_schema() or public.can_edit_company(p_company_id)) then
    raise exception 'Not authorized to edit company %', p_company_id using errcode = '42501';
  end if;

  delete from public.erp_suppliers where company_id = p_company_id;
  insert into public.erp_suppliers (company_id, id, name, phone, opening_balance, raw_data)
  select p_company_id, item->>'id', coalesce(item->>'name', ''), item->>'phone',
    coalesce(nullif(item->>'openingBalance', '')::numeric, 0), item
  from jsonb_array_elements(coalesce(p_payload->'suppliers', '[]'::jsonb)) item
  where item ? 'id';

  delete from public.erp_customers where company_id = p_company_id;
  insert into public.erp_customers (company_id, id, name, email, phone, opening_balance, raw_data)
  select p_company_id, item->>'id', coalesce(item->>'name', ''), item->>'email', item->>'phone',
    coalesce(nullif(item->>'openingBalance', '')::numeric, 0), item
  from jsonb_array_elements(coalesce(p_payload->'customers', '[]'::jsonb)) item
  where item ? 'id';

  delete from public.erp_items where company_id = p_company_id;
  insert into public.erp_items (company_id, id, name, unit, category, item_code, purchase_price, sales_price, gst_rate, opening_stock, opening_value, raw_data)
  select p_company_id, item->>'id', coalesce(item->>'name', ''), coalesce(item->>'unit', 'MT'),
    item->>'category', item->>'itemCode',
    coalesce(nullif(item->>'purchasePrice', '')::numeric, 0),
    coalesce(nullif(item->>'salesPrice', '')::numeric, 0),
    nullif(item->>'gstRate', '')::numeric,
    coalesce(nullif(item->>'openingStock', '')::numeric, 0),
    coalesce(nullif(item->>'openingValue', '')::numeric, 0),
    item
  from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) item
  where item ? 'id';

  delete from public.erp_purchase_invoice_items where company_id = p_company_id and invoice_id in (
    select id from public.erp_purchase_invoices where company_id = p_company_id and fy = p_fy
  );
  delete from public.erp_purchase_invoices where company_id = p_company_id and fy = p_fy;
  insert into public.erp_purchase_invoices (company_id, id, supplier_id, invoice_no, invoice_date, fy, quantity_mt, invoice_amount, additional_cost, amount_paid, raw_data)
  select p_company_id, item->>'id', item->>'supplierId', coalesce(item->>'invoiceNo', ''),
    (item->>'invoiceDate')::date, coalesce(item->>'fy', p_fy),
    coalesce(nullif(item->>'quantityMT', '')::numeric, 0),
    coalesce(nullif(item->>'invoiceAmount', '')::numeric, 0),
    coalesce(nullif(item->>'additionalCost', '')::numeric, 0),
    coalesce(nullif(item->>'amountPaid', '')::numeric, 0),
    item
  from jsonb_array_elements(coalesce(p_payload->'invoices', '[]'::jsonb)) item
  where item ? 'id' and item ? 'supplierId' and item ? 'invoiceDate';

  insert into public.erp_purchase_invoice_items (company_id, invoice_id, line_no, item_id, quantity_mt, basic_rate, rate, amount, raw_data)
  select p_company_id, invoice->>'id', line.ordinality::integer, line.item->>'itemId',
    coalesce(nullif(line.item->>'quantityMT', '')::numeric, 0),
    coalesce(nullif(line.item->>'basicRate', '')::numeric, 0),
    coalesce(nullif(line.item->>'rate', '')::numeric, 0),
    coalesce(nullif(line.item->>'amount', '')::numeric, 0),
    line.item
  from jsonb_array_elements(coalesce(p_payload->'invoices', '[]'::jsonb)) invoice
  cross join lateral jsonb_array_elements(coalesce(invoice->'items', '[]'::jsonb)) with ordinality as line(item, ordinality)
  where invoice ? 'id' and line.item ? 'itemId';

  delete from public.erp_supplier_payments where company_id = p_company_id and fy = p_fy;
  insert into public.erp_supplier_payments (company_id, id, supplier_id, payment_date, fy, amount, payment_mode, is_advance, booking_mt, booking_market_rate, raw_data)
  select p_company_id, item->>'id', item->>'supplierId', (item->>'paymentDate')::date,
    coalesce(item->>'fy', p_fy),
    coalesce(nullif(item->>'amount', '')::numeric, 0),
    item->>'paymentMode',
    coalesce(nullif(item->>'isAdvance', '')::boolean, false),
    coalesce(nullif(item->>'bookingMT', '')::numeric, 0),
    nullif(item->>'bookingMarketRate', '')::numeric,
    item
  from jsonb_array_elements(coalesce(p_payload->'payments', '[]'::jsonb)) item
  where item ? 'id' and item ? 'supplierId' and item ? 'paymentDate';

  delete from public.erp_sales_invoice_items where company_id = p_company_id and invoice_id in (
    select id from public.erp_sales_invoices where company_id = p_company_id and fy = p_fy
  );
  delete from public.erp_sales_invoices where company_id = p_company_id and fy = p_fy;
  insert into public.erp_sales_invoices (company_id, id, customer_id, invoice_no, invoice_date, fy, quantity_mt, invoice_amount, additional_cost, amount_received, raw_data)
  select p_company_id, item->>'id', item->>'customerId', coalesce(item->>'invoiceNo', ''),
    (item->>'invoiceDate')::date, coalesce(item->>'fy', p_fy),
    coalesce(nullif(item->>'quantityMT', '')::numeric, 0),
    coalesce(nullif(item->>'invoiceAmount', '')::numeric, 0),
    coalesce(nullif(item->>'additionalCost', '')::numeric, 0),
    coalesce(nullif(item->>'amountReceived', '')::numeric, 0),
    item
  from jsonb_array_elements(coalesce(p_payload->'salesInvoices', '[]'::jsonb)) item
  where item ? 'id' and item ? 'customerId' and item ? 'invoiceDate';

  insert into public.erp_sales_invoice_items (company_id, invoice_id, line_no, item_id, quantity_mt, basic_rate, rate, amount, raw_data)
  select p_company_id, invoice->>'id', line.ordinality::integer, line.item->>'itemId',
    coalesce(nullif(line.item->>'quantityMT', '')::numeric, 0),
    coalesce(nullif(line.item->>'basicRate', '')::numeric, 0),
    coalesce(nullif(line.item->>'rate', '')::numeric, 0),
    coalesce(nullif(line.item->>'amount', '')::numeric, 0),
    line.item
  from jsonb_array_elements(coalesce(p_payload->'salesInvoices', '[]'::jsonb)) invoice
  cross join lateral jsonb_array_elements(coalesce(invoice->'items', '[]'::jsonb)) with ordinality as line(item, ordinality)
  where invoice ? 'id' and line.item ? 'itemId';

  delete from public.erp_customer_payments where company_id = p_company_id and fy = p_fy;
  insert into public.erp_customer_payments (company_id, id, customer_id, payment_date, fy, amount, payment_mode, counter_id, raw_data)
  select p_company_id, item->>'id', item->>'customerId', (item->>'paymentDate')::date,
    coalesce(item->>'fy', p_fy), coalesce(nullif(item->>'amount', '')::numeric, 0),
    item->>'paymentMode', item->>'counterId', item
  from jsonb_array_elements(coalesce(p_payload->'customerPayments', '[]'::jsonb)) item
  where item ? 'id' and item ? 'customerId' and item ? 'paymentDate';

  delete from public.erp_expense_types where company_id = p_company_id;
  insert into public.erp_expense_types (company_id, id, name, link_type, raw_data)
  select p_company_id, item->>'id', coalesce(item->>'name', ''), coalesce(item->>'linkType', 'netprofit'), item
  from jsonb_array_elements(coalesce(p_payload->'expenseTypes', '[]'::jsonb)) item
  where item ? 'id';

  delete from public.erp_expense_entries where company_id = p_company_id and fy = p_fy;
  insert into public.erp_expense_entries (company_id, id, expense_type_id, supplier_id, expense_date, fy, amount, linked_invoice_id, payment_mode, raw_data)
  select p_company_id, item->>'id', item->>'expenseTypeId', item->>'supplierId',
    (item->>'expenseDate')::date, coalesce(item->>'fy', p_fy),
    coalesce(nullif(item->>'amount', '')::numeric, 0), item->>'linkedInvoiceId',
    item->>'paymentMode', item
  from jsonb_array_elements(coalesce(p_payload->'expenseEntries', '[]'::jsonb)) item
  where item ? 'id' and item ? 'expenseTypeId' and item ? 'expenseDate';

  delete from public.erp_fixed_schemes where company_id = p_company_id;
  insert into public.erp_fixed_schemes (company_id, id, supplier_id, scheme_name, rate_per_mt, from_date, to_date, raw_data)
  select p_company_id, item->>'id', item->>'supplierId', coalesce(item->>'schemeName', ''),
    coalesce(nullif(item->>'ratePerMT', '')::numeric, 0), (item->>'fromDate')::date,
    (item->>'toDate')::date, item
  from jsonb_array_elements(coalesce(p_payload->'fixedSchemes', '[]'::jsonb)) item
  where item ? 'id' and item ? 'supplierId' and item ? 'fromDate' and item ? 'toDate';

  delete from public.erp_mt_bookings where company_id = p_company_id and fy = p_fy;
  insert into public.erp_mt_bookings (company_id, id, supplier_id, order_date, consume_start_date, fy, booked_mt, booked_market_rate, raw_data)
  select p_company_id, item->>'id', item->>'supplierId', (item->>'orderDate')::date,
    (item->>'consumeStartDate')::date, coalesce(item->>'fy', p_fy),
    coalesce(nullif(item->>'bookedMT', '')::numeric, 0),
    nullif(item->>'bookedMarketRate', '')::numeric,
    item
  from jsonb_array_elements(coalesce(p_payload->'mtBookings', '[]'::jsonb)) item
  where item ? 'id' and item ? 'supplierId' and item ? 'orderDate' and item ? 'consumeStartDate';

  delete from public.erp_received_discounts where company_id = p_company_id and fy = p_fy;
  insert into public.erp_received_discounts (company_id, id, supplier_id, discount_received_date, fy, amount, type, status, raw_data)
  select p_company_id, item->>'id', item->>'supplierId', (item->>'discountReceivedDate')::date,
    coalesce(item->>'fy', p_fy), coalesce(nullif(item->>'amount', '')::numeric, 0),
    coalesce(item->>'type', 'wallet'), coalesce(item->>'status', 'Allocated'), item
  from jsonb_array_elements(coalesce(p_payload->'receivedDiscounts', '[]'::jsonb)) item
  where item ? 'id' and item ? 'supplierId' and item ? 'discountReceivedDate';

  insert into public.audit_logs (company_id, tenant_key, user_id, action, details)
  values (p_company_id, null, auth.uid(), 'relational_tenant_synced', jsonb_build_object('fy', p_fy));
end;
$$;

create or replace function public.get_relational_tenant(
  p_company_id text,
  p_fy text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not (public.can_maintain_erp_schema() or public.is_company_member(p_company_id)) then
    raise exception 'Not authorized to read company %', p_company_id using errcode = '42501';
  end if;

  select jsonb_build_object(
    'suppliers', coalesce((select jsonb_agg(raw_data order by name) from public.erp_suppliers where company_id = p_company_id), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(raw_data order by name) from public.erp_customers where company_id = p_company_id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(raw_data order by name) from public.erp_items where company_id = p_company_id), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(
        jsonb_set(
          pi.raw_data,
          '{items}',
          coalesce((
            select jsonb_agg(pii.raw_data order by pii.line_no)
            from public.erp_purchase_invoice_items pii
            where pii.company_id = pi.company_id and pii.invoice_id = pi.id
          ), '[]'::jsonb),
          true
        )
        order by pi.invoice_date, pi.created_at
      )
      from public.erp_purchase_invoices pi
      where pi.company_id = p_company_id and pi.fy = p_fy
    ), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(raw_data order by payment_date, created_at) from public.erp_supplier_payments where company_id = p_company_id and fy = p_fy), '[]'::jsonb),
    'receivedDiscounts', coalesce((select jsonb_agg(raw_data order by discount_received_date, created_at) from public.erp_received_discounts where company_id = p_company_id and fy = p_fy), '[]'::jsonb),
    'salesInvoices', coalesce((
      select jsonb_agg(
        jsonb_set(
          si.raw_data,
          '{items}',
          coalesce((
            select jsonb_agg(sii.raw_data order by sii.line_no)
            from public.erp_sales_invoice_items sii
            where sii.company_id = si.company_id and sii.invoice_id = si.id
          ), '[]'::jsonb),
          true
        )
        order by si.invoice_date, si.created_at
      )
      from public.erp_sales_invoices si
      where si.company_id = p_company_id and si.fy = p_fy
    ), '[]'::jsonb),
    'customerPayments', coalesce((select jsonb_agg(raw_data order by payment_date, created_at) from public.erp_customer_payments where company_id = p_company_id and fy = p_fy), '[]'::jsonb),
    'expenseTypes', coalesce((select jsonb_agg(raw_data order by name) from public.erp_expense_types where company_id = p_company_id), '[]'::jsonb),
    'expenseEntries', coalesce((select jsonb_agg(raw_data order by expense_date, created_at) from public.erp_expense_entries where company_id = p_company_id and fy = p_fy), '[]'::jsonb),
    'fixedSchemes', coalesce((select jsonb_agg(raw_data order by from_date, created_at) from public.erp_fixed_schemes where company_id = p_company_id), '[]'::jsonb),
    'mtBookings', coalesce((select jsonb_agg(raw_data order by order_date, created_at) from public.erp_mt_bookings where company_id = p_company_id and fy = p_fy), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.sync_relational_tenant(text, text, jsonb) to authenticated, service_role;
grant execute on function public.get_relational_tenant(text, text) to authenticated, service_role;

do $$
declare
  snapshot_payload jsonb;
begin
  select payload into snapshot_payload
  from public.tenant_snapshots
  where company_id = 'sk_traders'
    and tenant_key = 'data_sk_traders_FY2026-27'
  order by updated_at desc
  limit 1;

  if snapshot_payload is not null
    and not exists (select 1 from public.erp_purchase_invoices where company_id = 'sk_traders' and fy = 'FY2026-27')
    and not exists (select 1 from public.erp_supplier_payments where company_id = 'sk_traders' and fy = 'FY2026-27')
  then
    perform public.sync_relational_tenant('sk_traders', 'FY2026-27', snapshot_payload);
  end if;
end $$;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
