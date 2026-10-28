-- =============================================================================================
-- Phase 3: distributor order fulfilment.
--
--   * Big orders need a confirmation before they ship. place_order flags an order when its
--     total reaches the distributor's `confirm_above_paisa` setting (default Rs 20,000). The
--     distributor either calls the dukandar and records "confirmed on call", or asks the
--     dukandar to confirm in the app. Either one unlocks `confirmed`.
--   * Status moves forward through update_order_status (new -> confirmed -> picking -> packed
--     -> dispatched). Confirming reserves stock FEFO; shortages are reported, not blocking.
--   * confirm_delivery checks the dukandar's 4-digit code, records delivered quantities,
--     restates the order to the delivered amount, moves stock out, posts the invoice to the
--     distributor's ledger and records cash collected at the door.
--   * Read models for the distributor portal: org_order_inbox, org_order_detail,
--     org_dashboard. The dukandar's phone and address are shared with the distributor the
--     order was placed with, and only with them.
-- =============================================================================================

alter table public.orders
  add column needs_confirmation boolean not null default false,
  add column confirmation_reasons text[] not null default '{}',
  add column phone_confirmed_at timestamptz,
  add column phone_confirmed_by uuid references public.profiles (id) on delete set null,
  add column shop_confirm_requested_at timestamptz,
  add column shop_confirmed_at timestamptz,
  add column shop_confirmed_by uuid references public.profiles (id) on delete set null;
comment on column public.orders.needs_confirmation is 'Big order: the distributor must confirm it with the dukandar (call or in-app) before shipping.';
comment on column public.orders.confirmation_reasons is 'Why the order was flagged: high_value, first_order (informational).';
create index orders_phone_confirmed_by_idx on public.orders (phone_confirmed_by);
create index orders_shop_confirmed_by_idx on public.orders (shop_confirmed_by);
create index orders_needs_confirmation_idx on public.orders (org_id) where needs_confirmation and status = 'new';

-- New organization setting: the order value from which a confirmation is required (0 = never).
create or replace function private.valid_org_settings(p_settings jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_val jsonb;
begin
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    return false;
  end if;
  for v_key, v_val in select e.key, e.value from jsonb_each(p_settings) as e loop
    case v_key
      when 'order_cutoff_time' then
        if jsonb_typeof(v_val) <> 'string' or (v_val #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
          return false;
        end if;
      when 'delivery_days' then
        if jsonb_typeof(v_val) <> 'array' or exists (
          select 1 from jsonb_array_elements(v_val) as d
          where jsonb_typeof(d) <> 'number' or (d #>> '{}') not in ('1', '2', '3', '4', '5', '6', '7')
        ) then
          return false;
        end if;
      when 'default_credit_limit_paisa', 'confirm_above_paisa' then
        if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}') !~ '^[0-9]{1,15}$' then
          return false;
        end if;
      when 'default_payment_terms_days', 'overdue_hold_days' then
        if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}') !~ '^[0-9]{1,3}$' or (v_val #>> '{}')::integer > 365 then
          return false;
        end if;
      when 'enforce_stock', 'daily_brief_whatsapp' then
        if jsonb_typeof(v_val) <> 'boolean' then
          return false;
        end if;
      when 'invoice_footer' then
        if jsonb_typeof(v_val) <> 'string' then
          return false;
        end if;
      else
        return false;
    end case;
  end loop;
  return true;
end;
$$;

create or replace function private.confirm_threshold_paisa(p_org_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((o.settings ->> 'confirm_above_paisa')::bigint, 2000000)
    from public.organizations o
   where o.id = p_org_id
$$;

-- Flags set when the order is created; later edits never clear a confirmation requirement.
create or replace function private.tg_orders_confirmation_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_threshold bigint := private.confirm_threshold_paisa(new.org_id);
  v_reasons text[] := '{}';
begin
  if v_threshold > 0 and new.total_paisa >= v_threshold then
    v_reasons := v_reasons || 'high_value'::text;
  end if;
  if not exists (
    select 1 from public.orders o
     where o.org_id = new.org_id and o.shop_id = new.shop_id and o.deleted_at is null
       and o.status in ('delivered', 'partially_delivered')
  ) then
    v_reasons := v_reasons || 'first_order'::text;
  end if;
  new.confirmation_reasons := v_reasons;
  new.needs_confirmation := 'high_value' = any (v_reasons);
  return new;
end;
$$;

create trigger confirmation_flags before insert on public.orders
  for each row execute function private.tg_orders_confirmation_flags();

-- Who may act on an order as the distributor (managers, warehouse) or deliver it (riders too).
create or replace function private.can_manage_org_order(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_permission(p_org_id, 'orders.manage')
$$;

create or replace function private.can_deliver_org_order(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_permission(p_org_id, 'orders.manage')
      or private.has_org_permission(p_org_id, 'delivery.manage')
      or exists (
        select 1 from public.org_members m
         where m.org_id = p_org_id and m.user_id = (select auth.uid())
           and m.status = 'active' and m.role = 'rider'
      )
$$;

create or replace function private.can_view_org_orders(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
     where m.org_id = p_org_id and m.user_id = (select auth.uid()) and m.status = 'active'
       and (
         m.role = 'rider'
         or m.permissions && array['orders.view', 'orders.manage', 'delivery.manage']
         or private.org_role_permissions(m.role) && array['orders.view', 'orders.manage', 'delivery.manage']
       )
  )
$$;

create or replace function private.actor_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(p.full_name, ''), p.phone::text) from public.profiles p where p.id = p_user_id
$$;

-- Pieces still needed for each line of an order (paid + free goods).
create or replace function private.order_piece_needs(p_order_id uuid)
returns table (distributor_product_id uuid, name text, pieces integer)
language sql
stable
security definer
set search_path = ''
as $$
  select oi.distributor_product_id, min(oi.name), sum(oi.base_qty + oi.free_base_qty)::integer
    from public.order_items oi
   where oi.order_id = p_order_id and oi.deleted_at is null
   group by oi.distributor_product_id
$$;

-- Reserves stock FEFO for an order. Products the distributor does not track (no batches) are
-- skipped; tracked products short of stock are returned so the distributor can act on them.
create or replace function private.reserve_order_stock(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  n record;
  b record;
  v_left integer;
  v_take integer;
  v_short jsonb := '[]'::jsonb;
begin
  select o.org_id into v_org from public.orders o where o.id = p_order_id;
  for n in select * from private.order_piece_needs(p_order_id) loop
    if not exists (
      select 1 from public.stock_batches sb
       where sb.org_id = v_org and sb.distributor_product_id = n.distributor_product_id
    ) then
      continue;
    end if;
    v_left := n.pieces;
    for b in
      select sb.id, sb.warehouse_id, sb.qty_on_hand - sb.qty_reserved as free_qty
        from public.stock_batches sb
        join public.warehouses w on w.id = sb.warehouse_id and w.is_active
       where sb.org_id = v_org
         and sb.distributor_product_id = n.distributor_product_id
         and sb.qty_on_hand > sb.qty_reserved
         and (sb.expiry_date is null or sb.expiry_date >= private.pkt_today())
       order by sb.expiry_date nulls last, sb.received_at, sb.id
       for update of sb
    loop
      exit when v_left <= 0;
      v_take := least(v_left, b.free_qty);
      update public.stock_batches set qty_reserved = qty_reserved + v_take where id = b.id;
      insert into public.stock_movements (org_id, warehouse_id, batch_id, distributor_product_id, movement_type, quantity, reference_type, reference_id, reason)
      values (v_org, b.warehouse_id, b.id, n.distributor_product_id, 'reserve', v_take, 'order', p_order_id, 'Order confirmed');
      v_left := v_left - v_take;
    end loop;
    if v_left > 0 then
      v_short := v_short || jsonb_build_array(jsonb_build_object(
        'distributor_product_id', n.distributor_product_id, 'name', n.name,
        'needed', n.pieces, 'short', v_left
      ));
    end if;
  end loop;
  return v_short;
end;
$$;

-- Takes delivered pieces out of stock FEFO (after reservations were released). Never drives a
-- batch below zero: untracked or missing stock is simply not deducted.
create or replace function private.dispatch_stock(p_order_id uuid, p_product_id uuid, p_pieces integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  b record;
  v_left integer := p_pieces;
  v_take integer;
begin
  if p_pieces <= 0 then
    return;
  end if;
  select o.org_id into v_org from public.orders o where o.id = p_order_id;
  for b in
    select sb.id, sb.warehouse_id, sb.qty_on_hand - sb.qty_reserved as free_qty, sb.unit_cost_paisa
      from public.stock_batches sb
      join public.warehouses w on w.id = sb.warehouse_id and w.is_active
     where sb.org_id = v_org
       and sb.distributor_product_id = p_product_id
       and sb.qty_on_hand > sb.qty_reserved
       and (sb.expiry_date is null or sb.expiry_date >= private.pkt_today())
     order by sb.expiry_date nulls last, sb.received_at, sb.id
     for update of sb
  loop
    exit when v_left <= 0;
    v_take := least(v_left, b.free_qty);
    update public.stock_batches set qty_on_hand = qty_on_hand - v_take where id = b.id;
    insert into public.stock_movements (org_id, warehouse_id, batch_id, distributor_product_id, movement_type, quantity, unit_cost_paisa, reference_type, reference_id, reason)
    values (v_org, b.warehouse_id, b.id, p_product_id, 'dispatch', -v_take, b.unit_cost_paisa, 'order', p_order_id, 'Delivered');
    v_left := v_left - v_take;
  end loop;
end;
$$;

-- One balanced journal in a distributor's book. p_lines: [{account_id, debit, credit, due_date?}].
create or replace function private.post_org_journal(
  p_org_id uuid,
  p_memo text,
  p_reference_type text,
  p_reference_id uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_journal uuid;
  l jsonb;
begin
  insert into public.ledger_journals (book_type, org_id, memo, reference_type, reference_id, posted_by)
  values ('org', p_org_id, p_memo, p_reference_type, p_reference_id, auth.uid())
  returning id into v_journal;
  for l in select e.value from jsonb_array_elements(p_lines) as e loop
    insert into public.ledger_entries (journal_id, account_id, book_type, org_id, debit_paisa, credit_paisa, due_date, memo, reference_type, reference_id)
    values (
      v_journal, (l ->> 'account_id')::uuid, 'org', p_org_id,
      coalesce((l ->> 'debit')::bigint, 0), coalesce((l ->> 'credit')::bigint, 0),
      (l ->> 'due_date')::date, p_memo, p_reference_type, p_reference_id
    );
  end loop;
  return v_journal;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- update_order_status: the distributor moves an order forward. Steps may be skipped (a small
-- distributor confirms and dispatches in one go) but never go backwards; cancelling is
-- cancel_order and delivering is confirm_delivery.
-- ---------------------------------------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid,
  p_to_status public.order_status,
  p_note text default null,
  p_phone_confirmed boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_order public.orders%rowtype;
  v_from public.order_status;
  v_name text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_short jsonb := '[]'::jsonb;
  v_org_name text;
begin
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;
  select * into v_order from public.orders where id = p_order_id and deleted_at is null for update;
  if not found or not private.can_view_org_orders(v_order.org_id) then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if not private.can_manage_org_order(v_order.org_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  v_from := v_order.status;
  if not (
    (v_from = 'new' and p_to_status = 'confirmed')
    or (v_from = 'confirmed' and p_to_status in ('picking', 'packed', 'dispatched'))
    or (v_from = 'picking' and p_to_status in ('packed', 'dispatched'))
    or (v_from = 'packed' and p_to_status = 'dispatched')
  ) then
    raise exception 'invalid_transition' using errcode = '55000', detail = v_from::text || '->' || p_to_status::text;
  end if;

  if p_to_status = 'confirmed' and v_order.needs_confirmation
     and v_order.phone_confirmed_at is null and v_order.shop_confirmed_at is null then
    if not coalesce(p_phone_confirmed, false) then
      raise exception 'confirmation_required' using errcode = '55000';
    end if;
    update public.orders set phone_confirmed_at = now(), phone_confirmed_by = v_uid where id = p_order_id;
    v_note := coalesce(v_note, 'Confirmed with the dukandar on a call');
  end if;

  v_name := private.actor_name(v_uid);
  update public.orders
     set status = p_to_status,
         confirmed_at = case when p_to_status = 'confirmed' then now() else confirmed_at end,
         picking_at = case when p_to_status = 'picking' then now() else picking_at end,
         packed_at = case when p_to_status = 'packed' then now() else packed_at end,
         dispatched_at = case when p_to_status = 'dispatched' then now() else dispatched_at end
   where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, org_id, shop_id, from_status, to_status, changed_by, changed_by_name, note)
  values (v_order.id, v_order.org_id, v_order.shop_id, v_from, p_to_status, v_uid, v_name, v_note);

  if p_to_status = 'confirmed' then
    v_short := private.reserve_order_stock(v_order.id);
  end if;

  select o.name into v_org_name from public.organizations o where o.id = v_order.org_id;
  if p_to_status in ('confirmed', 'dispatched') then
    perform private.notify_shop(
      v_order.shop_id, array['orders'], 'order',
      case p_to_status
        when 'confirmed' then 'Order ' || v_order.order_number || ' confirmed'
        else 'Order ' || v_order.order_number || ' is on the way'
      end,
      case p_to_status
        when 'confirmed' then v_org_name || ' is preparing your order.'
        else 'Keep your delivery code ready for the rider.'
      end,
      jsonb_build_object(
        'event', case p_to_status when 'confirmed' then 'order.confirmed' else 'order.dispatched' end,
        'order_id', v_order.id, 'order_number', v_order.order_number, 'org_name', v_org_name
      ),
      '/dukan/orders/' || v_order.id
    );
  end if;
  perform private.enqueue_webhook(
    v_order.org_id, 'order.status_changed',
    jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'status', p_to_status)
  );

  return jsonb_build_object('id', v_order.id, 'status', v_order.status, 'shortages', v_short);
end;
$$;

-- The distributor asks the dukandar to confirm a new order in the app (at most every 5 minutes).
create or replace function public.request_shop_confirmation(p_order_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_org_name text;
begin
  perform private.require_user();
  select * into v_order from public.orders where id = p_order_id and deleted_at is null for update;
  if not found or not private.can_view_org_orders(v_order.org_id) then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if not private.can_manage_org_order(v_order.org_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_order.status <> 'new' or v_order.shop_confirmed_at is not null then
    raise exception 'invalid_transition' using errcode = '55000', detail = v_order.status::text;
  end if;
  if v_order.shop_confirm_requested_at > now() - interval '5 minutes' then
    raise exception 'too_soon' using errcode = '55000';
  end if;

  update public.orders set shop_confirm_requested_at = now() where id = p_order_id;
  select o.name into v_org_name from public.organizations o where o.id = v_order.org_id;
  perform private.notify_shop(
    v_order.shop_id, array['orders'], 'order',
    'Please confirm order ' || v_order.order_number,
    v_org_name || ' · Rs ' || to_char(v_order.total_paisa / 100, 'FM999,999,999,990') || '. Tap to confirm.',
    jsonb_build_object(
      'event', 'order.confirmation_requested', 'order_id', v_order.id,
      'order_number', v_order.order_number, 'org_name', v_org_name, 'total_paisa', v_order.total_paisa
    ),
    '/dukan/orders/' || v_order.id
  );
  return jsonb_build_object('id', v_order.id, 'requested_at', now());
end;
$$;

-- The dukandar confirms their own new order (after the distributor asked, or on their own).
create or replace function public.confirm_order_as_shop(p_order_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_order public.orders%rowtype;
  v_shop_name text;
begin
  select * into v_order from public.orders where id = p_order_id and deleted_at is null for update;
  if not found or not private.has_shop_permission(v_order.shop_id, 'orders') then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'new' then
    raise exception 'invalid_transition' using errcode = '55000', detail = v_order.status::text;
  end if;
  if v_order.shop_confirmed_at is not null then
    return jsonb_build_object('id', v_order.id, 'shop_confirmed_at', v_order.shop_confirmed_at);
  end if;

  update public.orders set shop_confirmed_at = now(), shop_confirmed_by = v_uid where id = p_order_id
  returning * into v_order;
  select s.name into v_shop_name from public.shops s where s.id = v_order.shop_id;
  perform private.notify_org(
    v_order.org_id, array['orders.view', 'orders.manage'], 'order',
    v_shop_name || ' confirmed ' || v_order.order_number,
    'You can ship it now.',
    jsonb_build_object(
      'event', 'order.shop_confirmed', 'order_id', v_order.id,
      'order_number', v_order.order_number, 'shop_name', v_shop_name
    ),
    '/distributor/orders/' || v_order.id
  );
  return jsonb_build_object('id', v_order.id, 'shop_confirmed_at', v_order.shop_confirmed_at);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- confirm_delivery: OTP check, delivered quantities, invoice, stock out, cash at the door.
-- A wrong code does not raise (that would roll back the attempt count): it returns
-- {ok: false, error: 'otp_invalid', attempts_left}. Five wrong codes lock delivery for the order.
-- p_lines (optional): [{order_item_id, delivered_base_qty}] for short deliveries; free goods
-- of a short line shrink in proportion.
-- ---------------------------------------------------------------------------------------------
create or replace function public.confirm_delivery(
  p_order_id uuid,
  p_otp text,
  p_cash_collected_paisa bigint default 0,
  p_lines jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_order public.orders%rowtype;
  v_otp public.delivery_otps%rowtype;
  v_from public.order_status;
  v_name text;
  i record;
  v_given integer;
  v_delivered integer;
  v_free integer;
  v_gross bigint;
  v_disc bigint;
  v_subtotal bigint := 0;
  v_scheme bigint := 0;
  v_total bigint;
  v_full boolean := true;
  v_any boolean := false;
  v_terms integer;
  v_invoice text;
  v_due date;
  v_cash bigint := coalesce(p_cash_collected_paisa, 0);
  v_payment uuid;
  v_journal uuid;
  n record;
begin
  select * into v_order from public.orders where id = p_order_id and deleted_at is null for update;
  if not found or not private.can_view_org_orders(v_order.org_id) then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if not private.can_deliver_org_order(v_order.org_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_order.status not in ('confirmed', 'picking', 'packed', 'dispatched') then
    raise exception 'invalid_transition' using errcode = '55000', detail = v_order.status::text || '->delivered';
  end if;
  if v_cash < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_lines is not null and jsonb_typeof(p_lines) <> 'array' then
    raise exception 'invalid_lines' using errcode = '22023';
  end if;

  select * into v_otp from public.delivery_otps where order_id = p_order_id for update;
  if v_otp.id is not null then
    if v_otp.attempts >= 5 then
      return jsonb_build_object('ok', false, 'error', 'otp_locked', 'attempts_left', 0);
    end if;
    if coalesce(btrim(p_otp), '') <> v_otp.code then
      update public.delivery_otps set attempts = attempts + 1 where id = v_otp.id;
      return jsonb_build_object('ok', false, 'error', 'otp_invalid', 'attempts_left', greatest(4 - v_otp.attempts, 0));
    end if;
  end if;

  -- Delivered quantities, line invoices and the restated order totals.
  for i in
    select oi.* from public.order_items oi where oi.order_id = p_order_id and oi.deleted_at is null for update
  loop
    v_given := (
      select (l.value ->> 'delivered_base_qty')::integer
        from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
       where (l.value ->> 'order_item_id')::uuid = i.id
       limit 1
    );
    if i.base_qty > 0 then
      v_delivered := coalesce(v_given, i.base_qty);
      if v_delivered < 0 or v_delivered > i.base_qty then
        raise exception 'invalid_quantity' using errcode = '22023', detail = i.id::text;
      end if;
      v_free := (i.free_base_qty::bigint * v_delivered / i.base_qty)::integer;
      v_gross := round(i.quantity * i.unit_price_paisa * v_delivered::numeric / i.base_qty)::bigint;
      v_disc := round(i.line_discount_paisa * v_delivered::numeric / i.base_qty)::bigint;
    else
      -- A free-goods line: the given quantity is the free pieces delivered.
      v_delivered := 0;
      v_free := coalesce(v_given, i.free_base_qty);
      if v_free < 0 or v_free > i.free_base_qty then
        raise exception 'invalid_quantity' using errcode = '22023', detail = i.id::text;
      end if;
      v_gross := 0;
      v_disc := 0;
    end if;
    v_subtotal := v_subtotal + v_gross;
    v_scheme := v_scheme + v_disc;
    v_full := v_full and v_delivered = i.base_qty and v_free = i.free_base_qty;
    v_any := v_any or v_delivered > 0 or v_free > 0;
    update public.order_items
       set delivered_base_qty = v_delivered,
           free_delivered_base_qty = v_free,
           short_base_qty = i.base_qty - v_delivered,
           invoiced_total_paisa = v_gross - v_disc
     where id = i.id;
  end loop;
  if not v_any then
    raise exception 'nothing_delivered' using errcode = '22023';
  end if;

  v_total := greatest(v_subtotal - v_order.discount_paisa - v_scheme + v_order.delivery_fee_paisa, 0);
  v_scheme := v_subtotal - v_order.discount_paisa + v_order.delivery_fee_paisa - v_total;
  if v_cash > v_total - v_order.paid_paisa then
    raise exception 'cash_exceeds_due' using errcode = '22023';
  end if;

  select coalesce(ra.payment_terms_days, 0) into v_terms
    from public.retailer_accounts ra where ra.org_id = v_order.org_id and ra.shop_id = v_order.shop_id;
  v_invoice := 'INV-' || substr(v_order.order_number, 4);
  v_due := private.pkt_today() + coalesce(v_terms, 0);
  v_from := v_order.status;
  v_name := private.actor_name(v_uid);

  update public.orders
     set status = case when v_full then 'delivered'::public.order_status else 'partially_delivered'::public.order_status end,
         subtotal_paisa = v_subtotal,
         scheme_discount_paisa = v_scheme,
         total_paisa = v_total,
         dispatched_at = coalesce(dispatched_at, now()),
         delivered_at = now(),
         invoice_number = v_invoice,
         invoiced_at = now(),
         due_date = v_due
   where id = p_order_id
  returning * into v_order;

  if v_otp.id is not null then
    update public.delivery_otps set verified_at = now() where id = v_otp.id;
  end if;

  insert into public.order_status_history (order_id, org_id, shop_id, from_status, to_status, changed_by, changed_by_name, note)
  values (v_order.id, v_order.org_id, v_order.shop_id, v_from, v_order.status, v_uid, v_name,
          case when v_full then null else 'Part of the order was delivered' end);

  -- Stock: whatever was held is released, then the delivered pieces leave the warehouse.
  perform private.release_order_reservations(v_order.id, 'Delivered');
  for n in
    select oi.distributor_product_id, sum(coalesce(oi.delivered_base_qty, 0) + coalesce(oi.free_delivered_base_qty, 0))::integer as pieces
      from public.order_items oi
     where oi.order_id = v_order.id and oi.deleted_at is null
     group by oi.distributor_product_id
  loop
    perform private.dispatch_stock(v_order.id, n.distributor_product_id, n.pieces);
  end loop;

  -- Invoice: the shop owes the distributor the delivered amount.
  if v_total > 0 then
    perform private.post_org_journal(
      v_order.org_id,
      'Invoice ' || v_invoice || ' (' || v_order.order_number || ')',
      'order', v_order.id,
      jsonb_build_array(
        jsonb_build_object('account_id', private.org_ledger_account(v_order.org_id, 'receivable', v_order.shop_id), 'debit', v_total, 'due_date', v_due),
        jsonb_build_object('account_id', private.org_ledger_account(v_order.org_id, 'sales'), 'credit', v_total)
      )
    );
  end if;

  -- Cash collected at the door settles the invoice (fully or in part).
  if v_cash > 0 then
    insert into public.payments (
      book_type, org_id, payer_type, payer_shop_id, amount_paisa, allocated_paisa, method,
      reference_no, status, collected_by, received_at, notes
    )
    values (
      'org', v_order.org_id, 'shop', v_order.shop_id, v_cash, v_cash, 'cash',
      'COD ' || v_order.order_number, 'confirmed', v_uid, now(), 'Collected at delivery.'
    )
    returning id into v_payment;
    v_journal := private.post_org_journal(
      v_order.org_id,
      'Cash on delivery for ' || v_order.order_number,
      'payment', v_payment,
      jsonb_build_array(
        jsonb_build_object('account_id', private.org_ledger_account(v_order.org_id, 'cash'), 'debit', v_cash),
        jsonb_build_object('account_id', private.org_ledger_account(v_order.org_id, 'receivable', v_order.shop_id), 'credit', v_cash)
      )
    );
    update public.payments set journal_id = v_journal where id = v_payment;
    insert into public.payment_allocations (payment_id, book_type, org_id, order_id, amount_paisa)
    values (v_payment, 'org', v_order.org_id, v_order.id, v_cash);
    update public.orders
       set paid_paisa = paid_paisa + v_cash,
           payment_status = case when paid_paisa + v_cash >= total_paisa then 'paid'::public.order_payment_status
                                 else 'partially_paid'::public.order_payment_status end
     where id = v_order.id
    returning * into v_order;
  elsif v_total = 0 then
    update public.orders set payment_status = 'paid' where id = v_order.id returning * into v_order;
  end if;

  perform private.notify_shop(
    v_order.shop_id, array['orders'], 'delivery',
    'Order ' || v_order.order_number || ' delivered',
    'Invoice ' || v_invoice || ' · Rs ' || to_char(v_order.total_paisa / 100, 'FM999,999,999,990'),
    jsonb_build_object(
      'event', 'order.delivered', 'order_id', v_order.id, 'order_number', v_order.order_number,
      'invoice_number', v_invoice, 'total_paisa', v_order.total_paisa
    ),
    '/dukan/orders/' || v_order.id
  );
  perform private.enqueue_webhook(
    v_order.org_id, 'order.delivered',
    jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'invoice_number', v_invoice,
                       'total_paisa', v_order.total_paisa, 'status', v_order.status)
  );

  return jsonb_build_object(
    'ok', true, 'id', v_order.id, 'status', v_order.status, 'invoice_number', v_invoice,
    'total_paisa', v_order.total_paisa, 'paid_paisa', v_order.paid_paisa
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Read models for the distributor portal
-- ---------------------------------------------------------------------------------------------

-- The dukan as the distributor sees it on an order: contact details for confirmation calls.
create or replace function private.order_shop_card(p_shop_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'phone', coalesce(s.phone::text, owner.phone::text),
    'whatsapp', coalesce(s.whatsapp::text, s.phone::text, owner.phone::text),
    'owner_name', owner.full_name,
    'owner_phone', owner.phone::text,
    'address_line', s.address_line,
    'area_name', a.name,
    'lat', s.lat,
    'lng', s.lng,
    'photo_path', s.photo_path,
    'tier', s.tier,
    'member_since', s.created_at
  )
    from public.shops s
    left join public.profiles owner on owner.id = s.owner_id
    left join public.service_areas a on a.id = s.area_id
   where s.id = p_shop_id
$$;

create or replace function public.org_order_inbox(
  p_org_id uuid,
  p_tab text default 'new',
  p_query text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_statuses public.order_status[];
  v_orders jsonb;
  v_counts jsonb;
begin
  perform private.require_user();
  if not private.can_view_org_orders(p_org_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_statuses := case coalesce(p_tab, 'new')
    when 'new' then array['new']::public.order_status[]
    when 'active' then array['confirmed', 'picking', 'packed', 'dispatched']::public.order_status[]
    when 'done' then array['delivered', 'partially_delivered', 'returned', 'cancelled']::public.order_status[]
    else enum_range(null::public.order_status)
  end;

  select jsonb_build_object(
           'new', count(*) filter (where o.status = 'new'),
           'needs_confirmation', count(*) filter (
             where o.status = 'new' and o.needs_confirmation
               and o.phone_confirmed_at is null and o.shop_confirmed_at is null
           ),
           'active', count(*) filter (where o.status in ('confirmed', 'picking', 'packed', 'dispatched')),
           'done', count(*) filter (where o.status in ('delivered', 'partially_delivered', 'returned', 'cancelled'))
         )
    into v_counts
    from public.orders o
   where o.org_id = p_org_id and o.deleted_at is null;

  select coalesce(jsonb_agg(row order by sort_key desc), '[]'::jsonb)
    into v_orders
    from (
      select jsonb_build_object(
               'id', o.id,
               'order_number', o.order_number,
               'status', o.status,
               'payment_method', o.payment_method,
               'payment_status', o.payment_status,
               'total_paisa', o.total_paisa,
               'created_at', o.created_at,
               'delivery_slot_start', o.delivery_slot_start,
               'delivery_slot_end', o.delivery_slot_end,
               'needs_confirmation', o.needs_confirmation,
               'confirmation_reasons', to_jsonb(o.confirmation_reasons),
               'phone_confirmed_at', o.phone_confirmed_at,
               'shop_confirmed_at', o.shop_confirmed_at,
               'shop_confirm_requested_at', o.shop_confirm_requested_at,
               'item_count', (select count(*) from public.order_items oi where oi.order_id = o.id and oi.deleted_at is null),
               'shop', private.order_shop_card(o.shop_id)
             ) as row,
             -- Unconfirmed big orders first, then newest.
             case when o.status = 'new' and o.needs_confirmation and o.phone_confirmed_at is null
                       and o.shop_confirmed_at is null then 1 else 0 end::text
               || to_char(o.created_at, 'YYYYMMDDHH24MISSUS') as sort_key
        from public.orders o
        join public.shops s on s.id = o.shop_id
       where o.org_id = p_org_id
         and o.deleted_at is null
         and o.status = any (v_statuses)
         and (
           v_q is null
           or o.order_number ilike '%' || v_q || '%'
           or s.name ilike '%' || v_q || '%'
           or (
             length(regexp_replace(v_q, '\D', '', 'g')) >= 4
             and s.phone::text like '%' || regexp_replace(v_q, '\D', '', 'g') || '%'
           )
         )
       order by sort_key desc
       limit least(greatest(coalesce(p_limit, 50), 1), 200)
      offset greatest(coalesce(p_offset, 0), 0)
    ) t;

  return jsonb_build_object('counts', v_counts, 'orders', v_orders);
end;
$$;

create or replace function public.org_order_detail(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_account public.retailer_accounts%rowtype;
  v_balance bigint;
  v_overdue bigint;
  v_history jsonb;
  v_items jsonb;
  v_stats jsonb;
  v_otp jsonb;
begin
  perform private.require_user();
  select * into v_order from public.orders where id = p_order_id and deleted_at is null;
  if not found or not private.can_view_org_orders(v_order.org_id) then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  select * into v_account from public.retailer_accounts ra where ra.org_id = v_order.org_id and ra.shop_id = v_order.shop_id;
  v_balance := private.receivable_balance(v_order.org_id, v_order.shop_id);
  select coalesce(sum(o.total_paisa - o.paid_paisa), 0) into v_overdue
    from public.orders o
   where o.org_id = v_order.org_id and o.shop_id = v_order.shop_id and o.deleted_at is null
     and o.status in ('delivered', 'partially_delivered') and o.due_date < private.pkt_today()
     and o.paid_paisa < o.total_paisa;

  select jsonb_build_object(
           'orders', count(*),
           'delivered', count(*) filter (where o.status in ('delivered', 'partially_delivered')),
           'cancelled', count(*) filter (where o.status = 'cancelled'),
           'delivered_value_paisa', coalesce(sum(o.total_paisa) filter (where o.status in ('delivered', 'partially_delivered')), 0),
           'first_order_at', min(o.created_at)
         )
    into v_stats
    from public.orders o
   where o.org_id = v_order.org_id and o.shop_id = v_order.shop_id and o.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', oi.id,
           'distributor_product_id', oi.distributor_product_id,
           'name', oi.name,
           'name_ur', oi.name_ur,
           'image_path', oi.image_path,
           'pack_label', oi.pack_label,
           'base_qty_per_unit', oi.base_qty_per_unit,
           'quantity', oi.quantity,
           'base_qty', oi.base_qty,
           'unit_price_paisa', oi.unit_price_paisa,
           'mrp_paisa', oi.mrp_paisa,
           'line_discount_paisa', oi.line_discount_paisa,
           'line_total_paisa', oi.line_total_paisa,
           'free_base_qty', oi.free_base_qty,
           'delivered_base_qty', oi.delivered_base_qty,
           'short_base_qty', oi.short_base_qty,
           'available_base_qty', (
             select sum(sb.qty_on_hand - sb.qty_reserved)::integer
               from public.stock_batches sb
              where sb.org_id = v_order.org_id and sb.distributor_product_id = oi.distributor_product_id
                and (sb.expiry_date is null or sb.expiry_date >= private.pkt_today())
           ),
           'reserved_base_qty', (
             select coalesce(sum(m.quantity), 0)::integer
               from public.stock_movements m
              where m.reference_type = 'order' and m.reference_id = v_order.id
                and m.distributor_product_id = oi.distributor_product_id
                and m.movement_type in ('reserve', 'release')
           )
         ) order by oi.created_at, oi.name), '[]'::jsonb)
    into v_items
    from public.order_items oi
   where oi.order_id = v_order.id and oi.deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', h.id, 'from_status', h.from_status, 'to_status', h.to_status,
           'changed_by_name', h.changed_by_name, 'note', h.note, 'created_at', h.created_at
         ) order by h.created_at), '[]'::jsonb)
    into v_history
    from public.order_status_history h
   where h.order_id = v_order.id;

  select jsonb_build_object('attempts', d.attempts, 'verified_at', d.verified_at)
    into v_otp
    from public.delivery_otps d where d.order_id = v_order.id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'source', v_order.source,
      'payment_method', v_order.payment_method,
      'payment_status', v_order.payment_status,
      'subtotal_paisa', v_order.subtotal_paisa,
      'scheme_discount_paisa', v_order.scheme_discount_paisa,
      'delivery_fee_paisa', v_order.delivery_fee_paisa,
      'total_paisa', v_order.total_paisa,
      'ordered_total_paisa', v_order.ordered_total_paisa,
      'paid_paisa', v_order.paid_paisa,
      'delivery_slot_start', v_order.delivery_slot_start,
      'delivery_slot_end', v_order.delivery_slot_end,
      'notes', v_order.notes,
      'placed_by_name', v_order.placed_by_name,
      'created_at', v_order.created_at,
      'confirmed_at', v_order.confirmed_at,
      'dispatched_at', v_order.dispatched_at,
      'delivered_at', v_order.delivered_at,
      'cancelled_at', v_order.cancelled_at,
      'cancel_reason', v_order.cancel_reason,
      'invoice_number', v_order.invoice_number,
      'due_date', v_order.due_date,
      'needs_confirmation', v_order.needs_confirmation,
      'confirmation_reasons', to_jsonb(v_order.confirmation_reasons),
      'confirm_threshold_paisa', private.confirm_threshold_paisa(v_order.org_id),
      'phone_confirmed_at', v_order.phone_confirmed_at,
      'shop_confirmed_at', v_order.shop_confirmed_at,
      'shop_confirm_requested_at', v_order.shop_confirm_requested_at
    ),
    'shop', private.order_shop_card(v_order.shop_id),
    'account', jsonb_build_object(
      'status', coalesce(v_account.status::text, 'none'),
      'credit_limit_paisa', coalesce(v_account.credit_limit_paisa, 0),
      'payment_terms_days', coalesce(v_account.payment_terms_days, 0),
      'balance_paisa', v_balance,
      'available_credit_paisa', greatest(coalesce(v_account.credit_limit_paisa, 0) - v_balance, 0),
      'overdue_paisa', v_overdue
    ),
    'stats', v_stats,
    'items', v_items,
    'history', v_history,
    'otp', v_otp,
    'can_manage', private.can_manage_org_order(v_order.org_id),
    'can_deliver', private.can_deliver_org_order(v_order.org_id)
  );
end;
$$;

-- Distributor home: today's numbers, the queue that needs action and the last 7 days of sales.
create or replace function public.org_dashboard(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.pkt_today();
  v_result jsonb;
begin
  perform private.require_user();
  if not private.can_view_org_orders(p_org_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'today_orders', count(*) filter (where (o.created_at at time zone 'Asia/Karachi')::date = v_today and o.status <> 'cancelled'),
    'today_value_paisa', coalesce(sum(o.ordered_total_paisa) filter (where (o.created_at at time zone 'Asia/Karachi')::date = v_today and o.status <> 'cancelled'), 0),
    'new_orders', count(*) filter (where o.status = 'new'),
    'needs_confirmation', count(*) filter (where o.status = 'new' and o.needs_confirmation and o.phone_confirmed_at is null and o.shop_confirmed_at is null),
    'to_dispatch', count(*) filter (where o.status in ('confirmed', 'picking', 'packed')),
    'out_for_delivery', count(*) filter (where o.status = 'dispatched'),
    'delivered_today_paisa', coalesce(sum(o.total_paisa) filter (where (o.delivered_at at time zone 'Asia/Karachi')::date = v_today), 0),
    'receivable_paisa', coalesce(sum(o.total_paisa - o.paid_paisa) filter (where o.status in ('delivered', 'partially_delivered')), 0),
    'overdue_paisa', coalesce(sum(o.total_paisa - o.paid_paisa) filter (where o.status in ('delivered', 'partially_delivered') and o.due_date < v_today), 0),
    'active_shops', count(distinct o.shop_id) filter (where o.created_at > now() - interval '30 days')
  )
    into v_result
    from public.orders o
   where o.org_id = p_org_id and o.deleted_at is null;

  return v_result || jsonb_build_object(
    'sales_7d', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d.day::date, 'value_paisa', coalesce(s.value, 0), 'orders', coalesce(s.orders, 0)) order by d.day), '[]'::jsonb)
        from generate_series(v_today - 6, v_today, interval '1 day') as d(day)
        left join (
          select (o.created_at at time zone 'Asia/Karachi')::date as day, sum(o.ordered_total_paisa) as value, count(*) as orders
            from public.orders o
           where o.org_id = p_org_id and o.deleted_at is null and o.status <> 'cancelled'
             and o.created_at >= (v_today - 6)::timestamp at time zone 'Asia/Karachi'
           group by 1
        ) s on s.day = d.day::date
    ),
    'top_shops', (
      select coalesce(jsonb_agg(t order by t.value_paisa desc), '[]'::jsonb)
        from (
          select s.id, s.name, sum(o.ordered_total_paisa) as value_paisa, count(*) as orders
            from public.orders o join public.shops s on s.id = o.shop_id
           where o.org_id = p_org_id and o.deleted_at is null and o.status <> 'cancelled'
             and o.created_at > now() - interval '30 days'
           group by s.id, s.name
           order by 3 desc
           limit 5
        ) t
    )
  );
end;
$$;

-- The dukandar sees the delivery code once the order is on its way (and before, so a quick
-- delivery never waits on the app). Codes stay hidden from the distributor.
create or replace function public.order_delivery_code(p_order_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.code
    from public.delivery_otps d
    join public.orders o on o.id = d.order_id
   where d.order_id = p_order_id
     and d.verified_at is null
     and o.status in ('new', 'confirmed', 'picking', 'packed', 'dispatched')
     and private.has_shop_permission(o.shop_id, 'orders')
$$;

revoke all on function public.update_order_status(uuid, public.order_status, text, boolean) from public, anon;
revoke all on function public.request_shop_confirmation(uuid) from public, anon;
revoke all on function public.confirm_order_as_shop(uuid) from public, anon;
revoke all on function public.confirm_delivery(uuid, text, bigint, jsonb) from public, anon;
revoke all on function public.org_order_inbox(uuid, text, text, integer, integer) from public, anon;
revoke all on function public.org_order_detail(uuid) from public, anon;
revoke all on function public.org_dashboard(uuid) from public, anon;
revoke all on function public.order_delivery_code(uuid) from public, anon;
grant execute on function public.update_order_status(uuid, public.order_status, text, boolean) to authenticated, service_role;
grant execute on function public.request_shop_confirmation(uuid) to authenticated, service_role;
grant execute on function public.confirm_order_as_shop(uuid) to authenticated, service_role;
grant execute on function public.confirm_delivery(uuid, text, bigint, jsonb) to authenticated, service_role;
grant execute on function public.org_order_inbox(uuid, text, text, integer, integer) to authenticated, service_role;
grant execute on function public.org_order_detail(uuid) to authenticated, service_role;
grant execute on function public.org_dashboard(uuid) to authenticated, service_role;
grant execute on function public.order_delivery_code(uuid) to authenticated, service_role;
