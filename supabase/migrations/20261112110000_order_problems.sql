-- "Report a problem" on a customer order: something missing, damaged or wrong, or the order is
-- late. It opens one support ticket per order (later reports add to it), puts the report in the
-- customer's support chat so the TezDukan team answers where they already work, and tells the
-- dukan straight away.

create or replace function public.report_order_problem(
  p_order_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_order public.customer_orders%rowtype;
  v_details text := nullif(left(btrim(coalesce(p_details, '')), 1000), '');
  v_label text;
  v_ticket uuid;
  v_conversation uuid;
  v_text text;
begin
  select * into v_order from public.customer_orders
   where id = p_order_id and customer_id = v_uid and deleted_at is null;
  if v_order.id is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.status in ('cancelled', 'rejected') then
    raise exception 'invalid_transition' using errcode = '55000';
  end if;
  v_label := case p_reason
    when 'missing_item' then 'Something is missing'
    when 'damaged' then 'Damaged or expired'
    when 'wrong_item' then 'Wrong item'
    when 'late' then 'Late delivery'
    when 'other' then 'Something else'
  end;
  if v_label is null then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  if p_reason = 'other' and v_details is null then
    raise exception 'details_required' using errcode = '22023';
  end if;
  v_text := format('Problem with order %s (%s): %s', v_order.order_number, v_order.shop_name, v_label)
            || coalesce(E'\n' || v_details, '');

  select t.id into v_ticket from public.support_tickets t
   where t.customer_order_id = v_order.id and t.opened_by = v_uid and t.status in ('open', 'pending')
   order by t.created_at desc
   limit 1;
  if v_ticket is null then
    insert into public.support_tickets (kind, priority, subject, opened_by, shop_id, customer_order_id)
    values (
      'dispute',
      case when p_reason in ('missing_item', 'damaged', 'wrong_item') then 'high' else 'normal' end::public.ticket_priority,
      left(format('%s: %s', v_order.order_number, v_label), 160),
      v_uid, v_order.shop_id, v_order.id
    )
    returning id into v_ticket;
  end if;
  insert into public.support_messages (ticket_id, author_id, body) values (v_ticket, v_uid, v_text);

  -- The support chat is where the team answers customers.
  v_conversation := public.open_conversation('support');
  perform public.send_chat_message(v_conversation, v_text);

  perform private.notify_shop(
    v_order.shop_id, array['customer_orders'], 'order',
    format('Problem reported on order %s', v_order.order_number),
    coalesce(v_label || ': ' || v_details, v_label),
    jsonb_build_object('event', 'customer_order.problem', 'customer_order_id', v_order.id,
                       'order_number', v_order.order_number, 'reason', p_reason),
    '/dukan/customer-orders/' || v_order.id
  );
  perform private.audit(
    'customer_order.problem_reported', 'customer_order', v_order.id, null, v_order.shop_id,
    null, jsonb_build_object('reason', p_reason, 'ticket_id', v_ticket)
  );
  return v_ticket;
end;
$$;

revoke execute on function public.report_order_problem(uuid, text, text) from public, anon;
grant execute on function public.report_order_problem(uuid, text, text) to authenticated;
