-- The customer storefront as a showroom. Shoppers rate the things they bought, so cards can show
-- real stars. Search understands Roman Urdu and typos (the same aliases the dukandar's
-- catalogue uses), products can be sorted and filtered by brand, a product page gets its
-- sizes and similar products, and categories and "Buy again" only count what can actually be
-- delivered to the shopper.

-- ---------------------------------------------------------------------------------------------
-- Product ratings: one per delivered order line, 1 to 5 stars.
-- ---------------------------------------------------------------------------------------------
create table public.product_ratings (
  id uuid primary key default gen_random_uuid(),
  customer_order_item_id uuid not null unique references public.customer_order_items (id) on delete cascade,
  customer_order_id uuid not null references public.customer_orders (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  inventory_id uuid references public.shop_inventory (id) on delete set null,
  master_product_id uuid references public.master_products (id) on delete set null,
  customer_id uuid references public.profiles (id) on delete set null,
  product_key uuid not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on column public.product_ratings.product_key is
  'What the stars count towards: the catalogue product when the dukan''s item is linked to one (every dukan selling it shares the rating), else the dukan''s own item.';
create index product_ratings_customer_order_id_idx on public.product_ratings (customer_order_id);
create index product_ratings_shop_id_idx on public.product_ratings (shop_id);
create index product_ratings_inventory_id_idx on public.product_ratings (inventory_id);
create index product_ratings_master_product_id_idx on public.product_ratings (master_product_id);
create index product_ratings_customer_id_idx on public.product_ratings (customer_id);
create index product_ratings_product_key_idx on public.product_ratings (product_key);
create index product_ratings_created_by_idx on public.product_ratings (created_by);

-- The running total per product, kept by a trigger, so a card never has to add up ratings.
create table public.product_rating_stats (
  id uuid primary key,
  rating_sum integer not null default 0 check (rating_sum >= 0),
  rating_count integer not null default 0 check (rating_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on column public.product_rating_stats.id is 'The product key (see product_ratings.product_key).';
create index product_rating_stats_created_by_idx on public.product_rating_stats (created_by);

create trigger set_row_metadata before insert or update on public.product_ratings
  for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.product_rating_stats
  for each row execute function private.set_row_metadata();

alter table public.product_ratings enable row level security;
alter table public.product_rating_stats enable row level security;

-- Ratings are written only by rate_order_items; totals only by the trigger.
create policy product_ratings_select on public.product_ratings for select to authenticated
  using (
    customer_id = (select auth.uid())
    or shop_id in (select private.my_shop_ids())
    or (select private.is_platform_staff())
  );
create policy product_rating_stats_select on public.product_rating_stats for select to authenticated
  using (true);

grant select on public.product_ratings, public.product_rating_stats to authenticated;
grant all on public.product_ratings, public.product_rating_stats to service_role;

create or replace function private.tg_product_rating_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.product_rating_stats
       set rating_sum = rating_sum - old.rating, rating_count = rating_count - 1
     where id = old.product_key;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.product_rating_stats (id, rating_sum, rating_count)
    values (new.product_key, new.rating, 1)
    on conflict (id) do update
      set rating_sum = public.product_rating_stats.rating_sum + excluded.rating_sum,
          rating_count = public.product_rating_stats.rating_count + 1;
  end if;
  return null;
end;
$$;
revoke execute on function private.tg_product_rating_stats() from public, anon;
grant execute on function private.tg_product_rating_stats() to authenticated, service_role;

create trigger product_rating_stats
  after insert or update of rating, product_key or delete on public.product_ratings
  for each row execute function private.tg_product_rating_stats();

-- The shopper rates lines of a delivered order: [{"item_id": "...", "rating": 4}, ...].
-- Rating a line again replaces the earlier stars.
create or replace function public.rate_order_items(p_order_id uuid, p_ratings jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_order public.customer_orders%rowtype;
  v_line jsonb;
  v_item public.customer_order_items%rowtype;
  v_master uuid;
  v_rating integer;
  v_count integer := 0;
begin
  select * into v_order from public.customer_orders
   where id = p_order_id and customer_id = v_uid and deleted_at is null;
  if v_order.id is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'not_delivered' using errcode = '22023';
  end if;
  if jsonb_typeof(p_ratings) is distinct from 'array' or jsonb_array_length(p_ratings) not between 1 and 100 then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;

  for v_line in select * from jsonb_array_elements(p_ratings) loop
    v_rating := (v_line ->> 'rating')::integer;
    if v_rating is null or v_rating not between 1 and 5 then
      raise exception 'invalid_rating' using errcode = '22023';
    end if;
    select * into v_item from public.customer_order_items
     where id = (v_line ->> 'item_id')::uuid and customer_order_id = p_order_id;
    if v_item.id is null then
      raise exception 'invalid_rating' using errcode = '22023';
    end if;
    -- An item the dukan has since deleted has nothing left to rate.
    continue when v_item.inventory_id is null;
    select i.master_product_id into v_master from public.shop_inventory i where i.id = v_item.inventory_id;
    insert into public.product_ratings (
      customer_order_item_id, customer_order_id, shop_id, inventory_id, master_product_id,
      customer_id, product_key, rating
    )
    values (
      v_item.id, p_order_id, v_item.shop_id, v_item.inventory_id, v_master,
      v_uid, coalesce(v_master, v_item.inventory_id), v_rating
    )
    on conflict (customer_order_item_id) do update set rating = excluded.rating;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- One description of "a product a shopper can buy", used by every storefront function.
-- ---------------------------------------------------------------------------------------------

-- "Tapal Danedar 95 g" and "Tapal Danedar 190 g" are sizes of one thing: the name without its
-- quantity, per brand. Used to offer the other sizes a dukan has.
create or replace function private.variant_key(p_name text, p_brand_id uuid)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(
           regexp_replace(
             lower(coalesce(p_name, '')),
             '\m\d+([.,]\d+)?\s*(kg|g|gm|grams?|ml|l|ltr|litres?|liters?|pcs?|pieces?|pack|sachets?|dozen)?\M',
             ' ', 'g'
           ),
           '\s+', ' ', 'g'
         )), '') || '|' || coalesce(p_brand_id::text, '')
$$;

create view private.storefront_items as
select i.id, i.shop_id, s.name as shop_name, s.slug as shop_slug,
       i.name, i.name_ur, i.pack_size_label, i.unit::text as unit, i.is_loose,
       i.selling_price_paisa, i.mrp_paisa, i.category_id, i.is_favourite,
       i.qty_on_hand > 0 as in_stock,
       i.qty_on_hand > 0 and i.qty_on_hand <= i.low_stock_threshold as low_stock,
       coalesce(
         i.image_path,
         mp.image_path,
         (select pi.path from public.product_images pi
           where pi.master_product_id = i.master_product_id
           order by pi.sort_order limit 1)
       ) as image_path,
       coalesce(i.brand_id, mp.brand_id) as brand_id,
       b.name as brand_name,
       case when rs.rating_count > 0 then round(rs.rating_sum::numeric / rs.rating_count, 1) end as rating,
       coalesce(rs.rating_count, 0) as rating_count,
       -- How many sizes of this product the same dukan has in stock.
       count(*) filter (where i.qty_on_hand > 0) over (
         partition by i.shop_id, private.variant_key(i.name, coalesce(i.brand_id, mp.brand_id))
       )::integer as sizes,
       -- For filtering and ranking only; never sent to the app.
       i.master_product_id, i.search_text, mp.description,
       private.variant_key(i.name, coalesce(i.brand_id, mp.brand_id)) as variant_key,
       s.location, ss.delivery_radius_m, ss.serves_all_city,
       -- How soon this dukan delivers, for the "30 min" line on a product.
       ss.eta_minutes,
       -- Picks the icon shown when a product has no photo.
       c.slug as category_slug
  from public.shop_inventory i
  join public.shops s on s.id = i.shop_id and s.status = 'approved'
  join public.storefront_settings ss on ss.shop_id = s.id and ss.is_live
  left join public.master_products mp on mp.id = i.master_product_id
  left join public.categories c on c.id = i.category_id
  left join public.brands b on b.id = coalesce(i.brand_id, mp.brand_id)
  left join public.product_rating_stats rs on rs.id = coalesce(i.master_product_id, i.id)
 where i.is_active and i.is_visible_online;

create or replace function private.storefront_item_json(it private.storefront_items)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', it.id, 'shop_id', it.shop_id, 'shop_name', it.shop_name, 'shop_slug', it.shop_slug,
    'name', it.name, 'name_ur', it.name_ur, 'pack_size_label', it.pack_size_label,
    'unit', it.unit, 'is_loose', it.is_loose,
    'selling_price_paisa', it.selling_price_paisa, 'mrp_paisa', it.mrp_paisa,
    'category_id', it.category_id, 'is_favourite', it.is_favourite,
    'in_stock', it.in_stock, 'low_stock', it.low_stock, 'image_path', it.image_path,
    'brand_id', it.brand_id, 'brand_name', it.brand_name,
    'rating', it.rating, 'rating_count', it.rating_count, 'sizes', it.sizes,
    'eta_minutes', it.eta_minutes, 'category_slug', it.category_slug
  )
$$;

-- How well a product answers what was typed: its own text, then the aliases of its catalogue
-- product, brand and category ("cheeni", "doodh", "taapal"). 0 to 1; 0.3 and up is a match.
create or replace function private.storefront_match(it private.storefront_items, p_q text)
returns real
language sql
stable
set search_path = ''
as $$
  select greatest(
    case when it.search_text like '%' || p_q || '%' then 1 else 0 end,
    extensions.word_similarity(p_q, it.search_text),
    extensions.similarity(p_q, it.search_text),
    coalesce((
      select max(greatest(
               extensions.similarity(p_q, a.alias_normalized),
               extensions.word_similarity(a.alias_normalized, p_q),
               extensions.word_similarity(p_q, a.alias_normalized)
             ) * a.weight)
        from public.product_aliases a
       where a.master_product_id = it.master_product_id
    ), 0),
    0.9 * coalesce((
      select max(greatest(
               extensions.similarity(p_q, a.alias_normalized),
               extensions.word_similarity(a.alias_normalized, p_q)
             ) * a.weight)
        from public.product_aliases a
       where a.brand_id = it.brand_id
    ), 0),
    0.9 * extensions.word_similarity(private.search_normalize(coalesce(it.brand_name, '')), p_q),
    0.7 * coalesce((
      select max(greatest(
               extensions.similarity(p_q, a.alias_normalized),
               extensions.word_similarity(a.alias_normalized, p_q)
             ) * a.weight)
        from public.product_aliases a
       where a.category_id = it.category_id
    ), 0)
  )::real
$$;

revoke execute on function private.storefront_item_json(private.storefront_items) from public, anon;
revoke execute on function private.storefront_match(private.storefront_items, text) from public, anon;
grant execute on function private.variant_key(text, uuid) to authenticated, service_role;
grant execute on function private.storefront_item_json(private.storefront_items) to authenticated, service_role;
grant execute on function private.storefront_match(private.storefront_items, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Products: search that forgives, a brand filter and a sort order.
--   sort: relevance (default) | price_asc | price_desc | discount | rating
-- Across dukans the same catalogue product is one tile, not one per dukan: the cheapest offer
-- (then the quickest) is shown, with "offers" saying how many dukans have it. Inside one dukan
-- every item shows.
-- ---------------------------------------------------------------------------------------------
drop function if exists public.storefront_products(uuid, text, uuid, integer, numeric, numeric);
create function public.storefront_products(
  p_category_id uuid default null,
  p_query text default null,
  p_shop_id uuid default null,
  p_limit integer default 60,
  p_lat numeric default null,
  p_lng numeric default null,
  p_brand_id uuid default null,
  p_sort text default 'relevance'
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with asked as (
    select nullif(private.search_normalize(btrim(coalesce(p_query, ''))), '') as q
  ),
  found as (
    select it, case when asked.q is null then 1::real else private.storefront_match(it, asked.q) end as score
      from private.storefront_items it
     cross join asked
     where (p_category_id is null or it.category_id = p_category_id)
       and (p_shop_id is null or it.shop_id = p_shop_id)
       and (p_brand_id is null or it.brand_id = p_brand_id)
       and (
         p_shop_id is not null or p_lat is null or p_lng is null
         or private.delivers_to(it.location, it.delivery_radius_m, it.serves_all_city, p_lat, p_lng)
       )
  ),
  offered as (
    select f.it, f.score,
           row_number() over (
             partition by coalesce((f.it).master_product_id, (f.it).id)
             order by (f.it).in_stock desc, (f.it).selling_price_paisa, (f.it).eta_minutes nulls last, (f.it).shop_name
           ) as offer_rank,
           count(*) filter (where (f.it).in_stock) over (
             partition by coalesce((f.it).master_product_id, (f.it).id)
           )::integer as offers
      from found f
     where f.score >= 0.3
  ),
  ranked as (
    select o.it, o.offers,
           row_number() over (
             order by
               (o.it).in_stock desc,
               case when coalesce(p_sort, 'relevance') = 'price_asc' then (o.it).selling_price_paisa end asc nulls last,
               case when p_sort = 'price_desc' then (o.it).selling_price_paisa end desc nulls last,
               case when p_sort = 'discount' and (o.it).mrp_paisa > (o.it).selling_price_paisa
                    then ((o.it).mrp_paisa - (o.it).selling_price_paisa)::numeric / (o.it).mrp_paisa end desc nulls last,
               case when p_sort = 'rating' then (o.it).rating end desc nulls last,
               o.score desc,
               (o.it).is_favourite desc,
               (o.it).rating_count desc,
               (o.it).name
           ) as position
      from offered o
     where p_shop_id is not null or o.offer_rank = 1
  )
  select coalesce(
           jsonb_agg(
             private.storefront_item_json(r.it) || jsonb_build_object('offers', r.offers)
             order by r.position
           ),
           '[]'::jsonb
         )
    from ranked r
   where r.position <= least(greatest(coalesce(p_limit, 60), 1), 200)
$$;

-- ---------------------------------------------------------------------------------------------
-- One product up close: its photos and description, the dukan's terms, the other sizes the
-- dukan has, the other dukans that sell the same product (to compare price and time), and
-- similar products the shopper can also get delivered.
-- ---------------------------------------------------------------------------------------------
create or replace function public.storefront_product(
  p_id uuid,
  p_lat numeric default null,
  p_lng numeric default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'product', private.storefront_item_json(it),
    'description', nullif(btrim(it.description), ''),
    'images', (
      select coalesce(jsonb_agg(distinct_path order by first_seen), '[]'::jsonb)
        from (
          select path as distinct_path, min(ordinal) as first_seen
            from (
              select it.image_path as path, 0 as ordinal where it.image_path is not null
              union all
              select pi.path, 1 + pi.sort_order
                from public.product_images pi
               where pi.master_product_id = it.master_product_id
            ) all_paths
           group by path
        ) paths
    ),
    'category', (
      select jsonb_build_object('id', c.id, 'name', c.name, 'name_ur', c.name_ur)
        from public.categories c where c.id = it.category_id
    ),
    'shop', (
      select jsonb_build_object(
               'id', s.id, 'name', s.name, 'slug', s.slug, 'photo_path', s.photo_path,
               'eta_minutes', ss.eta_minutes,
               'min_order_paisa', coalesce(ss.min_order_paisa, 0),
               'delivery_fee_paisa', coalesce(ss.delivery_fee_paisa, 0),
               'free_delivery_above_paisa', ss.free_delivery_above_paisa,
               'rating', r.rating, 'rating_count', r.rating_count,
               'delivers_here', p_lat is null or p_lng is null
                 or private.delivers_to(s.location, ss.delivery_radius_m, ss.serves_all_city, p_lat, p_lng)
             )
        from public.shops s
        join public.storefront_settings ss on ss.shop_id = s.id
        cross join lateral (
          select round(avg(rv.rating), 1) as rating, count(*)::integer as rating_count
            from public.reviews rv
           where rv.target_type = 'shop' and rv.shop_id = s.id and rv.is_published
        ) r
       where s.id = it.shop_id
    ),
    'sizes', (
      select coalesce(jsonb_agg(private.storefront_item_json(v) order by v.selling_price_paisa, v.name), '[]'::jsonb)
        from private.storefront_items v
       where v.shop_id = it.shop_id and v.variant_key = it.variant_key and v.in_stock
    ),
    'offers', (
      select coalesce(
               jsonb_agg(private.storefront_item_json(o) order by o.selling_price_paisa, o.eta_minutes nulls last, o.shop_name),
               '[]'::jsonb
             )
        from private.storefront_items o
       where it.master_product_id is not null
         and o.master_product_id = it.master_product_id
         and o.id <> it.id
         and o.in_stock
         and (
           p_lat is null or p_lng is null
           or private.delivers_to(o.location, o.delivery_radius_m, o.serves_all_city, p_lat, p_lng)
         )
    ),
    'similar', (
      select coalesce(jsonb_agg(private.storefront_item_json(x.o) order by x.position), '[]'::jsonb)
        from (
          select y.o, row_number() over (
                   order by ((y.o).shop_id = it.shop_id) desc, (y.o).rating desc nulls last,
                            (y.o).rating_count desc, (y.o).name
                 ) as position
            from (
              select o, row_number() over (
                       partition by coalesce(o.master_product_id, o.id)
                       order by (o.shop_id = it.shop_id) desc, o.selling_price_paisa, o.eta_minutes nulls last
                     ) as offer_rank
                from private.storefront_items o
               where o.category_id = it.category_id
                 and o.id <> it.id
                 and o.variant_key is distinct from it.variant_key
                 and (it.master_product_id is null or o.master_product_id is distinct from it.master_product_id)
                 and o.in_stock
                 and (
                   p_lat is null or p_lng is null
                   or private.delivers_to(o.location, o.delivery_radius_m, o.serves_all_city, p_lat, p_lng)
                 )
            ) y
           where y.offer_rank = 1
        ) x
       where x.position <= 12
    )
  )
    from private.storefront_items it
   where it.id = p_id
$$;

-- ---------------------------------------------------------------------------------------------
-- Categories and "Buy again" count only what can be delivered to the shopper.
-- storefront_categories() without a place stays as it was (every category); with a place each
-- category says how many products can be delivered there. The place has no default, so the two
-- can never be confused with each other.
-- ---------------------------------------------------------------------------------------------
create function public.storefront_categories(p_lat numeric, p_lng numeric)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order, x.name), '[]'::jsonb)
    from (
      select c.id, c.name, c.name_ur, c.slug, c.image_path, c.tint, c.sort_order,
             (select count(*)::integer
                from private.storefront_items it
               where it.category_id = c.id and it.in_stock
                 and (
                   p_lat is null or p_lng is null
                   or private.delivers_to(it.location, it.delivery_radius_m, it.serves_all_city, p_lat, p_lng)
                 )) as product_count
        from public.categories c
       where c.parent_id is null and c.is_active
    ) x
$$;

drop function if exists public.my_buy_again(integer);
create function public.my_buy_again(
  p_limit integer default 12,
  p_lat numeric default null,
  p_lng numeric default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(private.storefront_item_json(x.it) order by x.times desc, (x.it).name), '[]'::jsonb)
    from (
      select it, b.times
        from (
          select coi.inventory_id, count(*) as times
            from public.customer_order_items coi
            join public.customer_orders co on co.id = coi.customer_order_id
           where co.customer_id = (select auth.uid()) and co.deleted_at is null
             and co.status not in ('cancelled', 'rejected')
           group by coi.inventory_id
        ) b
        join private.storefront_items it on it.id = b.inventory_id
       where it.in_stock
         and (
           p_lat is null or p_lng is null
           or private.delivers_to(it.location, it.delivery_radius_m, it.serves_all_city, p_lat, p_lng)
         )
       order by b.times desc, it.name
       limit least(greatest(coalesce(p_limit, 12), 1), 40)
    ) x
$$;

-- Brands a shopper can browse: those with something in stock that can be delivered.
create or replace function public.storefront_brands(p_lat numeric default null, p_lng numeric default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.product_count desc, x.name), '[]'::jsonb)
    from (
      select b.id, b.name, b.name_ur, b.logo_path, count(*)::integer as product_count
        from private.storefront_items it
        join public.brands b on b.id = it.brand_id and b.is_active
       where it.in_stock
         and (
           p_lat is null or p_lng is null
           or private.delivers_to(it.location, it.delivery_radius_m, it.serves_all_city, p_lat, p_lng)
         )
       group by b.id, b.name, b.name_ur, b.logo_path
       order by count(*) desc, b.name
       limit 40
    ) x
$$;

revoke execute on function public.rate_order_items(uuid, jsonb) from public, anon;
revoke execute on function public.storefront_products(uuid, text, uuid, integer, numeric, numeric, uuid, text) from public, anon;
revoke execute on function public.storefront_product(uuid, numeric, numeric) from public, anon;
revoke execute on function public.storefront_categories(numeric, numeric) from public, anon;
revoke execute on function public.my_buy_again(integer, numeric, numeric) from public, anon;
revoke execute on function public.storefront_brands(numeric, numeric) from public, anon;
grant execute on function public.rate_order_items(uuid, jsonb) to authenticated;
grant execute on function public.storefront_products(uuid, text, uuid, integer, numeric, numeric, uuid, text) to authenticated;
grant execute on function public.storefront_product(uuid, numeric, numeric) to authenticated;
grant execute on function public.storefront_categories(numeric, numeric) to authenticated;
grant execute on function public.my_buy_again(integer, numeric, numeric) to authenticated;
grant execute on function public.storefront_brands(numeric, numeric) to authenticated;
