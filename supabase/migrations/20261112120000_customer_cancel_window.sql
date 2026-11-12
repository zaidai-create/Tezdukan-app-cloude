-- Cancelling a customer order, fair to both sides (the rule the big delivery apps use):
-- * free while it is only placed: the dukan has not started;
-- * for 2 minutes after the dukan accepts, if it is not packed yet, with a reason the dukan sees
--   (src/features/customer-orders/cancel-policy.ts keeps the same window for the screen);
-- * never once packed or on the way: the customer calls the dukan or asks support instead.
-- Same signature as before, so callers and grants are unchanged.

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
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 200), '');
begin
  select * into v_order from public.customer_orders where id = p_order_id and deleted_at is null for update;
  if v_order.id is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  v_is_staff := private.has_shop_permission(v_order.shop_id, 'customer_orders');

  if v_order.customer_id = v_uid and not v_is_staff then
    -- Free while the dukan has not started. Once accepted, a short grace window (a quick
    -- "I ordered the wrong thing") with a reason the dukan sees; after that, or once packed, the
    -- dukan has done the work, so the customer calls the dukan instead.
    if p_to <> 'cancelled' then
      v_allowed := false;
    elsif v_order.status = 'placed' then
      v_allowed := true;
    elsif v_order.status = 'accepted' and v_order.accepted_at > now() - interval '2 minutes' then
      if v_reason is null then
        raise exception 'reason_required' using errcode = '22023';
      end if;
      v_allowed := true;
    elsif v_order.status in ('accepted', 'packed', 'out_for_delivery') then
      raise exception 'too_late_to_cancel' using errcode = '55000';
    else
      v_allowed := false;
    end if;
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
    cancel_reason = case when p_to = 'cancelled' then v_reason else cancel_reason end,
    rejected_reason = case when p_to = 'rejected' then v_reason else rejected_reason end
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
                         'reason', v_reason),
      '/orders/' || v_order.id
    );
  elsif p_to = 'cancelled' then
    perform private.notify_shop(
      v_order.shop_id, array['customer_orders'], 'order',
      format('Order %s cancelled by the customer', v_order.order_number),
      coalesce(v_order.customer_name, 'Customer') || coalesce(' · ' || v_reason, ''),
      jsonb_build_object('event', 'customer_order.cancelled_by_customer', 'customer_order_id', v_order.id,
                         'order_number', v_order.order_number, 'customer_name', v_order.customer_name,
                         'reason', v_reason),
      '/dukan/customer-orders/' || v_order.id
    );
  end if;

  return v_order;
end;
$$;
