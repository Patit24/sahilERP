-- Advance MT Booking server workflow
-- Run this in Supabase SQL Editor after supabase-setup.sql.

alter table public.erp_supplier_payments
  add column if not exists booking_mt numeric not null default 0;

update public.erp_supplier_payments
set booking_mt = coalesce((raw_data->>'bookingMT')::numeric, 0)
where booking_mt = 0
  and raw_data ? 'bookingMT'
  and nullif(raw_data->>'bookingMT', '') is not null;

create or replace function public.set_supplier_payment_booking_mt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.booking_mt := coalesce(nullif(new.raw_data->>'bookingMT', '')::numeric, 0);
  new.is_advance := coalesce(new.is_advance, false) or new.booking_mt > 0;
  return new;
end;
$$;

drop trigger if exists set_supplier_payment_booking_mt_before_write on public.erp_supplier_payments;
create trigger set_supplier_payment_booking_mt_before_write
before insert or update on public.erp_supplier_payments
for each row execute function public.set_supplier_payment_booking_mt();

create table if not exists public.advance_booking_pickups (
  company_id text not null,
  id uuid not null default gen_random_uuid(),
  payment_id text not null,
  supplier_id text not null,
  pickup_date date not null,
  quantity_mt numeric not null check (quantity_mt > 0),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

create table if not exists public.discount_ledger_entries (
  company_id text not null,
  id uuid not null default gen_random_uuid(),
  source_type text not null check (source_type in ('advance_pickup')),
  source_id text not null,
  payment_id text not null,
  supplier_id text not null,
  payment_date date not null,
  pickup_date date not null,
  quantity_mt numeric not null check (quantity_mt > 0),
  payment_scheme_name text,
  payment_scheme_rate numeric not null default 0,
  payment_scheme_details jsonb not null default '[]'::jsonb,
  pickup_scheme_name text,
  pickup_scheme_rate numeric not null default 0,
  pickup_scheme_details jsonb not null default '[]'::jsonb,
  applied_scheme_source text not null check (applied_scheme_source in ('payment', 'pickup', 'none')),
  applied_scheme_name text,
  applied_rate_per_mt numeric not null default 0,
  discount_amount numeric not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (company_id, id),
  unique (company_id, source_type, source_id)
);

alter table public.advance_booking_pickups enable row level security;
alter table public.discount_ledger_entries enable row level security;

drop policy if exists advance_booking_pickups_select on public.advance_booking_pickups;
create policy advance_booking_pickups_select
on public.advance_booking_pickups
for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists discount_ledger_entries_select on public.discount_ledger_entries;
create policy discount_ledger_entries_select
on public.discount_ledger_entries
for select
to authenticated
using (public.is_company_member(company_id));

-- Intentionally no insert/update/delete policies. The RPC below is the only write path.

create or replace view public.advance_booking_balances as
select
  p.company_id,
  p.id as payment_id,
  p.supplier_id,
  s.name as supplier_name,
  p.payment_date,
  p.fy,
  p.amount,
  p.booking_mt,
  coalesce(sum(abp.quantity_mt), 0) as picked_up_mt,
  greatest(p.booking_mt - coalesce(sum(abp.quantity_mt), 0), 0) as pending_mt
from public.erp_supplier_payments p
left join public.erp_suppliers s
  on s.company_id = p.company_id
 and s.id = p.supplier_id
left join public.advance_booking_pickups abp
  on abp.company_id = p.company_id
 and abp.payment_id = p.id
where p.booking_mt > 0
group by p.company_id, p.id, p.supplier_id, s.name, p.payment_date, p.fy, p.amount, p.booking_mt;

alter view public.advance_booking_balances set (security_invoker = true);

create or replace function public.touch_advance_booking_pickup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_advance_booking_pickup_updated_at on public.advance_booking_pickups;
create trigger touch_advance_booking_pickup_updated_at
before update on public.advance_booking_pickups
for each row execute function public.touch_advance_booking_pickup();

create or replace function public.record_advance_pickup(
  p_company_id text,
  p_payment_id text,
  p_pickup_date date,
  p_quantity_mt numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_existing_pickup_mt numeric := 0;
  v_pending_mt numeric := 0;
  v_pickup_id uuid;
  v_payment_scheme record;
  v_pickup_scheme record;
  v_applied_source text := 'none';
  v_applied_name text;
  v_applied_rate numeric := 0;
  v_discount_amount numeric := 0;
begin
  if not public.can_edit_company(p_company_id) then
    raise exception 'Not authorized to edit company %', p_company_id using errcode = '42501';
  end if;

  if p_quantity_mt is null or p_quantity_mt <= 0 then
    raise exception 'Pickup quantity must be greater than zero' using errcode = '22023';
  end if;

  select *
  into v_payment
  from public.erp_supplier_payments
  where company_id = p_company_id
    and id = p_payment_id
    and booking_mt > 0;

  if not found then
    raise exception 'Advance booking payment not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(quantity_mt), 0)
  into v_existing_pickup_mt
  from public.advance_booking_pickups
  where company_id = p_company_id
    and payment_id = p_payment_id;

  v_pending_mt := greatest(v_payment.booking_mt - v_existing_pickup_mt, 0);

  if p_quantity_mt > v_pending_mt then
    raise exception 'Pickup quantity %.3f MT exceeds pending balance %.3f MT', p_quantity_mt, v_pending_mt using errcode = '22023';
  end if;

  select
    coalesce(sum(rate_per_mt), 0) as total_rate,
    nullif(string_agg(scheme_name, ' + ' order by scheme_name), '') as scheme_name,
    coalesce(
      jsonb_agg(jsonb_build_object('id', id, 'schemeName', scheme_name, 'ratePerMT', rate_per_mt) order by scheme_name)
        filter (where id is not null),
      '[]'::jsonb
    ) as scheme_details
  into v_payment_scheme
  from public.erp_fixed_schemes
  where company_id = p_company_id
    and supplier_id = v_payment.supplier_id
    and v_payment.payment_date between from_date and to_date
    and coalesce((raw_data->>'applyInMTBooking')::boolean, true) = true;

  select
    coalesce(sum(rate_per_mt), 0) as total_rate,
    nullif(string_agg(scheme_name, ' + ' order by scheme_name), '') as scheme_name,
    coalesce(
      jsonb_agg(jsonb_build_object('id', id, 'schemeName', scheme_name, 'ratePerMT', rate_per_mt) order by scheme_name)
        filter (where id is not null),
      '[]'::jsonb
    ) as scheme_details
  into v_pickup_scheme
  from public.erp_fixed_schemes
  where company_id = p_company_id
    and supplier_id = v_payment.supplier_id
    and p_pickup_date between from_date and to_date
    and coalesce((raw_data->>'applyInMTBooking')::boolean, true) = true;

  if coalesce(v_payment_scheme.total_rate, 0) = 0 and coalesce(v_pickup_scheme.total_rate, 0) = 0 then
    v_applied_source := 'none';
    v_applied_name := null;
    v_applied_rate := 0;
  elsif coalesce(v_payment_scheme.total_rate, 0) >= coalesce(v_pickup_scheme.total_rate, 0) then
    v_applied_source := 'payment';
    v_applied_name := v_payment_scheme.scheme_name;
    v_applied_rate := coalesce(v_payment_scheme.total_rate, 0);
  else
    v_applied_source := 'pickup';
    v_applied_name := v_pickup_scheme.scheme_name;
    v_applied_rate := coalesce(v_pickup_scheme.total_rate, 0);
  end if;

  v_discount_amount := round(p_quantity_mt * v_applied_rate, 2);

  insert into public.advance_booking_pickups (
    company_id,
    payment_id,
    supplier_id,
    pickup_date,
    quantity_mt,
    notes,
    created_by
  )
  values (
    p_company_id,
    p_payment_id,
    v_payment.supplier_id,
    p_pickup_date,
    p_quantity_mt,
    p_notes,
    auth.uid()
  )
  returning id into v_pickup_id;

  insert into public.discount_ledger_entries (
    company_id,
    source_type,
    source_id,
    payment_id,
    supplier_id,
    payment_date,
    pickup_date,
    quantity_mt,
    payment_scheme_name,
    payment_scheme_rate,
    payment_scheme_details,
    pickup_scheme_name,
    pickup_scheme_rate,
    pickup_scheme_details,
    applied_scheme_source,
    applied_scheme_name,
    applied_rate_per_mt,
    discount_amount,
    details,
    created_by
  )
  values (
    p_company_id,
    'advance_pickup',
    v_pickup_id::text,
    p_payment_id,
    v_payment.supplier_id,
    v_payment.payment_date,
    p_pickup_date,
    p_quantity_mt,
    v_payment_scheme.scheme_name,
    coalesce(v_payment_scheme.total_rate, 0),
    coalesce(v_payment_scheme.scheme_details, '[]'::jsonb),
    v_pickup_scheme.scheme_name,
    coalesce(v_pickup_scheme.total_rate, 0),
    coalesce(v_pickup_scheme.scheme_details, '[]'::jsonb),
    v_applied_source,
    v_applied_name,
    v_applied_rate,
    v_discount_amount,
    jsonb_build_object(
      'maxBenefitLogic', true,
      'notes', p_notes,
      'pendingBeforeMT', v_pending_mt,
      'pendingAfterMT', v_pending_mt - p_quantity_mt
    ),
    auth.uid()
  );

  insert into public.audit_logs (company_id, tenant_key, user_id, action, details)
  values (
    p_company_id,
    null,
    auth.uid(),
    'advance_pickup_recorded',
    jsonb_build_object(
      'paymentId', p_payment_id,
      'pickupId', v_pickup_id,
      'pickupDate', p_pickup_date,
      'quantityMT', p_quantity_mt,
      'appliedSchemeSource', v_applied_source,
      'appliedRatePerMT', v_applied_rate,
      'discountAmount', v_discount_amount
    )
  );

  return v_pickup_id;
end;
$$;

grant select on public.advance_booking_balances to authenticated;
grant select on public.advance_booking_pickups to authenticated;
grant select on public.discount_ledger_entries to authenticated;
grant execute on function public.record_advance_pickup(text, text, date, numeric, text) to authenticated;
