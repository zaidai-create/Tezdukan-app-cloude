-- Customer orders placed in the app: the shopper's cart becomes an order at one dukan, priced
-- by the database from the dukan's live storefront (never from the client), and the dukan
-- accepts, packs, sends and delivers it. Both sides are notified at each step. Delivery records
-- a sale in the dukan's stock ledger.

alter publication supabase_realtime add table public.customer_orders;

create or replace function public.place_customer_order(
  p_shop_id uuid,
  p_items jsonb,
  p_address text,
  p_note text default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_profile public.profiles%rowtype;
  v_shop public.shops%rowtype;
  v_settings public.storefront_settings%rowtype;
  v_existing public.customer_orders%rowtype;
  v_line jsonb;
  v_item public.shop_inventory%rowtype;
  v_qty integer;
  v_subtotal bigint := 0;
  v_count integer := 0;
  v_fee bigint;
  v_order public.customer_orders%rowtype;
begin
  if p_request_id is not null then
    select * into v_existing from public.customer_orders
     where client_request_id = p_request_id and customer_id = v_uid;
    if v_existing.id is not null then
      return jsonb_build_object('id', v_existing.id, 'order_number', v_existing.order_number,
                                'total_paisa', v_existing.total_paisa);
    end if;
  end if;

  select * into v_shop from public.shops where id = p_shop_id and status = 'approved';
  select * into v_settings from public.storefront_settings where shop_id = p_shop_id;
  if v_shop.id is null or not coalesce(v_settings.is_live, false) then
    raise exception 'shop_not_taking_orders' using errcode = '55000';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'empty_order' using errcode = '22023';
  end if;
  if char_length(coalesce(btrim(p_address), '')) < 5 then
    raise exception 'address_required' using errcode = '22023';
  end if;

  -- Price and check every line against the dukan's shelf.
  for v_line in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_line ->> 'qty')::integer;
    if v_qty is null or v_qty not between 1 and 999 then
      raise exception 'invalid_quantity' using errcode = '22023';
    end if;
    select * into v_item from public.shop_inventory
     where id = (v_line ->> 'inventory_id')::uuid and shop_id = p_shop_id
       and is_active and is_visible_online;
    if v_item.id is null then
      raise exception 'item_unavailable' using errcode = '55000';
    end if;
    if v_item.qty_on_hand < v_qty then
      raise exception 'out_of_stock' using errcode = '55000', detail = v_item.name;
    end if;
    v_subtotal := v_subtotal + v_item.selling_price_paisa * v_qty;
    v_count := v_count + v_qty;
  end loop;

  if v_subtotal < coalesce(v_settings.min_order_paisa, 0) then
    raise exception 'below_minimum' using errcode = '55000';
  end if;
  v_fee := case
    when v_settings.free_delivery_above_paisa is not null and v_subtotal >= v_settings.free_delivery_above_paisa then 0
    else coalesce(v_settings.delivery_fee_paisa, 0)
  end;

  select * into v_profile from public.profiles where id = v_uid;
  insert into public.customer_orders (
    order_number, shop_id, customer_id, shop_name, customer_name, customer_phone,
    items_count, subtotal_paisa, delivery_fee_paisa, total_paisa,
    delivery_address, notes, client_request_id
  )
  values (
    'C-' || lpad(private.next_counter('customer_order_number')::text, 6, '0'),
    p_shop_id, v_uid, v_shop.name, v_profile.full_name, v_profile.phone,
    v_count, v_subtotal, v_fee, v_subtotal + v_fee,
    jsonb_build_object('text', btrim(p_address)), nullif(btrim(p_note), ''), p_request_id
  )
  returning * into v_order;

  insert into public.customer_order_items (
    customer_order_id, shop_id, customer_id, inventory_id, name, name_ur, image_path, unit,
    qty, unit_price_paisa, mrp_paisa, line_total_paisa
  )
  select v_order.id, p_shop_id, v_uid, i.id, i.name, i.name_ur,
         coalesce(i.image_path, mp.image_path), i.unit,
         (l ->> 'qty')::integer, i.selling_price_paisa, i.mrp_paisa,
         i.selling_price_paisa * (l ->> 'qty')::integer
    from jsonb_array_elements(p_items) l
    join public.shop_inventory i on i.id = (l ->> 'inventory_id')::uuid
    left join public.master_products mp on mp.id = i.master_product_id;

  perform private.notify_shop(
    p_shop_id, array['customer_orders'], 'order',
    format('New order %s', v_order.order_number),
    format('%s · Rs %s', coalesce(v_profile.full_name, 'Customer'), v_order.total_paisa / 100),
    jsonb_build_object('event', 'customer_order.placed', 'customer_order_id', v_order.id,
                       'order_number', v_order.order_number, 'total_paisa', v_order.total_paisa,
                       'customer_name', v_profile.full_name),
    '/dukan/customer-orders/' || v_order.id
  );

  return jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number,
                            'total_paisa', v_order.total_paisa);
end;
$$;

-- The dukan moves an order along; the customer may cancel while it is still only placed.
create or replace function public.update_customer_order_status(
  p_order_id uuid,
  p_to public.customer_order_status,
  p_reason text default null
)
returns public.customer_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_order public.customer_orders%rowtype;
  v_is_staff boolean;
  v_allowed boolean;
  v_item record;
  v_balance numeric;
begin
  select * into v_order from public.customer_orders where id = p_order_id and deleted_at is null for update;
  if v_order.id is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  v_is_staff := private.has_shop_permission(v_order.shop_id, 'customer_orders');

  if v_order.customer_id = v_uid and not v_is_staff then
    v_allowed := v_order.status = 'placed' and p_to = 'cancelled';
  elsif v_is_staff then
    v_allowed := case v_order.status
      when 'placed' then p_to in ('accepted', 'rejected')
      when 'accepted' then p_to in ('packed', 'out_for_delivery', 'delivered', 'cancelled')
      when 'packed' then p_to in ('out_for_delivery', 'delivered', 'cancelled')
      when 'out_for_delivery' then p_to in ('delivered')
      else false
    end;
  else
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not v_allowed then
    raise exception 'invalid_transition' using errcode = '55000',
      detail = format('%s to %s', v_order.status, p_to);
  end if;

  update public.customer_orders set
    status = p_to,
    accepted_at = case when p_to = 'accepted' then now() else accepted_at end,
    packed_at = case when p_to = 'packed' then now() else packed_at end,
    out_for_delivery_at = case when p_to = 'out_for_delivery' then now() else out_for_delivery_at end,
    delivered_at = case when p_to = 'delivered' then now() else delivered_at end,
    payment_status = case when p_to = 'delivered' and payment_method = 'cod' then 'paid' else payment_status end,
    cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end,
    cancelled_by = case when p_to = 'cancelled' then v_uid else cancelled_by end,
    cancel_reason = case when p_to = 'cancelled' then nullif(btrim(p_reason), '') else cancel_reason end,
    rejected_reason = case when p_to = 'rejected' then nullif(btrim(p_reason), '') else rejected_reason end
  where id = p_order_id
  returning * into v_order;

  -- Delivered goods leave the shelf: one sale movement per line, never below zero.
  if p_to = 'delivered' then
    for v_item in
      select oi.inventory_id, oi.qty, i.qty_on_hand, i.cost_price_paisa
        from public.customer_order_items oi
        join public.shop_inventory i on i.id = oi.inventory_id
       where oi.customer_order_id = p_order_id
    loop
      v_balance := greatest(v_item.qty_on_hand - v_item.qty, 0);
      if v_balance <> v_item.qty_on_hand then
        update public.shop_inventory set qty_on_hand = v_balance where id = v_item.inventory_id;
        insert into public.shop_stock_movements (
          shop_id, inventory_id, movement_type, qty, balance_after, unit_cost_paisa,
          reference_type, reference_id, reason
        )
        values (
          v_order.shop_id, v_item.inventory_id, 'sale', v_balance - v_item.qty_on_hand, v_balance,
          v_item.cost_price_paisa, 'customer_order', v_order.id, 'Online order ' || v_order.order_number
        );
      end if;
    end loop;
  end if;

  if v_is_staff and v_order.customer_id is not null then
    perform private.notify(
      v_order.customer_id, 'order',
      format('Order %s %s', v_order.order_number, replace(p_to::text, '_', ' ')),
      v_order.shop_name,
      jsonb_build_object('event', 'customer_order.' || p_to::text, 'customer_order_id', v_order.id,
                         'order_number', v_order.order_number, 'shop_name', v_order.shop_name,
                         'reason', nullif(btrim(p_reason), '')),
      '/orders/' || v_order.id
    );
  elsif p_to = 'cancelled' then
    perform private.notify_shop(
      v_order.shop_id, array['customer_orders'], 'order',
      format('Order %s cancelled', v_order.order_number), v_order.customer_name,
      jsonb_build_object('event', 'customer_order.cancelled_by_customer', 'customer_order_id', v_order.id,
                         'order_number', v_order.order_number, 'customer_name', v_order.customer_name),
      '/dukan/customer-orders/' || v_order.id
    );
  end if;

  return v_order;
end;
$$;

revoke execute on function public.place_customer_order(uuid, jsonb, text, text, uuid) from public, anon;
revoke execute on function public.update_customer_order_status(uuid, public.customer_order_status, text) from public, anon;
grant execute on function public.place_customer_order(uuid, jsonb, text, text, uuid) to authenticated;
grant execute on function public.update_customer_order_status(uuid, public.customer_order_status, text) to authenticated;
