--
-- Tables, functions and views.
--
-- A shop sells PRODUCTS, made from MATERIALS, through a bill of materials in
-- product_materials. A product may itself be built from other products
-- (product_components), which is what lets a bouquet be twelve flowers rather
-- than a flat list of ribbon. Stock moves through production_runs, material_lots
-- and material_usage, so what a thing cost can be answered from what was
-- actually made rather than from a number somebody typed.
--
-- The access helpers -- is_staff, is_owner, is_manager -- are the hinge of the
-- security model in 0006: every policy asks one of them rather than re-deriving
-- who the caller is, so there is one definition of what a role may do.
--
-- Part of the baseline schema.
--
-- This is a new database with no history, so the schema is the state it should
-- be in rather than a replay of changes that never happened here. It was made by
-- loading the original system's forty-one migrations into Postgres, renaming the
-- food vocabulary in place so the database itself rewrote the foreign keys,
-- indexes and policies, and dumping the result -- then checked by loading it
-- back into an empty database.
--
-- The order of these files is the order Postgres resolved, not one chosen here.
-- From this point the ordinary rule applies: never edit a migration that has
-- run. Add a new one.
--

-- Settings every file in the baseline runs under.
--
-- check_function_bodies is the load-bearing one. A LANGUAGE sql function is
-- parsed when it is created, and several here read tables that are declared
-- further down the same file -- bump_faq_hit reads faq_entries about twelve
-- hundred lines before it exists. Turning the check off lets the schema load
-- in dependency order for tables while leaving functions where they read
-- best. Dropping this line was what made the first split fail.
--
-- search_path is emptied so every reference has to name its schema, which is
-- why everything below says public.<name> rather than trusting a path that a
-- caller could change underneath it.
SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path TO '';
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: apply_order_stock(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_order_stock(p_order_id text) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
declare
  v_date date;
  v_revenue numeric;
  v_cogs numeric := 0;
  v_per_unit numeric;
  req record;
begin
  -- Claim first. Two staff marking the same order "confirmed" at the same
  -- moment must not deduct the pork twice.
  update orders
  set stock_applied_at = now()
  where id = p_order_id and stock_applied_at is null
  returning date, revenue into v_date, v_revenue;

  if not found then
    return null; -- already applied, or no such order
  end if;

  for req in select * from order_requirements(p_order_id) loop
    if req.ref_type = 'inv' then
      v_cogs := v_cogs + consume_material(req.ref_id, req.qty, v_date, 'sale');
    elsif req.ref_type = 'production_run' then
      v_per_unit := production_run_cost_per_unit(req.ref_id);
      update production_runs set run_stock = run_stock - req.qty where id = req.ref_id;
      v_cogs := v_cogs + req.qty * coalesce(v_per_unit, 0);
    end if;
  end loop;

  -- The cost actually taken off the shelf, which beats the estimate the app
  -- wrote from current recipe prices when the order was created.
  update orders
  set cogs = round(v_cogs, 2),
      gross_profit = round(coalesce(v_revenue, 0) - v_cogs, 2)
  where id = p_order_id;

  return round(v_cogs, 2);
end;
$$;


--
-- Name: production_run_cost_per_unit(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.production_run_cost_per_unit(p_production_run_id text) RETURNS numeric
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_manual numeric;
  v_yield numeric;
  v_total numeric;
begin
  select manual_cost_per_unit, yield_qty into v_manual, v_yield
  from production_runs where id = p_production_run_id;

  if v_manual is not null and v_manual > 0 then
    -- A repack — bought ready-made and split into portions. It has no recipe
    -- by design, so its cost is the number that was typed in.
    return v_manual;
  end if;

  if v_yield is null or v_yield <= 0 then
    return 0; -- no yield, so there is no per-unit cost to state
  end if;

  select coalesce(sum(bi.qty * i.cost), 0) into v_total
  from production_run_materials bi
  join materials i on i.id = bi.material_id
  where bi.production_run_id = p_production_run_id;

  return v_total / v_yield;
end;
$$;


--
-- Name: bump_faq_hit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_faq_hit(p_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update faq_entries set hits = hits + 1 where id = p_id;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: staff_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_shifts (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    staff_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    closing_cash numeric,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    auto_closed boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.staff_shifts REPLICA IDENTITY FULL;


--
-- Name: clock_in(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clock_in(p_staff_id uuid) RETURNS public.staff_shifts
    LANGUAGE plpgsql
    AS $$
declare
  v_shift staff_shifts;
begin
  -- Already clocked in? Hand back the shift that is running rather than
  -- refusing: two devices, or a reloaded page, must not become an error the
  -- person has to think about mid-service.
  select * into v_shift from staff_shifts
  where staff_id = p_staff_id and ended_at is null
  order by started_at desc limit 1;
  if found then
    return v_shift;
  end if;

  insert into staff_shifts (staff_id) values (p_staff_id) returning * into v_shift;
  return v_shift;
end;
$$;


--
-- Name: clock_out(uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clock_out(p_staff_id uuid, p_closing_cash numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text) RETURNS public.staff_shifts
    LANGUAGE plpgsql
    AS $$
declare
  v_shift staff_shifts;
begin
  update staff_shifts
  set ended_at = now(),
      closing_cash = p_closing_cash,
      note = nullif(btrim(coalesce(p_note, '')), '')
  where staff_id = p_staff_id and ended_at is null
  returning * into v_shift;

  -- Nothing open is not an error: the shift may have been closed on another
  -- device a moment ago. Returned as null rather than as a row of nulls,
  -- which is what falls out of a composite-returning function by default and
  -- would reach the app looking like a shift with no id.
  if not found then
    return null;
  end if;
  return v_shift;
end;
$$;


--
-- Name: close_stale_shifts(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_stale_shifts(p_hours integer DEFAULT 14) RETURNS SETOF public.staff_shifts
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return query
  update staff_shifts
  set ended_at = now(),
      auto_closed = true,
      note = case
               when coalesce(btrim(note), '') = ''
                 then 'Closed automatically — nobody clocked out, so the drawer was never counted.'
               else note || ' · Closed automatically — nobody clocked out.'
             end
  where ended_at is null
    and started_at < now() - make_interval(hours => greatest(1, p_hours))
  returning *;
end $$;


--
-- Name: consume_material(text, numeric, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_material(p_material_id text, p_qty numeric, p_date date, p_type text) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
declare
  v_remaining numeric := p_qty;
  v_cost numeric := 0;
  v_take numeric;
  v_standard numeric;
  lot record;
begin
  if p_qty is null or p_qty <= 0 then return 0; end if;

  select cost into v_standard from materials where id = p_material_id;
  if not found then
    -- A recipe pointing at a deleted material. Nothing to take, and the
    -- costing screens already flag it by name.
    return 0;
  end if;

  for lot in
    select id, qty, cost from material_lots
    where material_id = p_material_id and qty > 0
    -- First-expiry-first-out: the tub that goes off on Friday is the tub you
    -- cook with today. A plain FIFO would leave it to be thrown away.
    order by coalesce(expiry_date, '9999-12-31'::date),
             coalesce(received_date, '1900-01-01'::date),
             id
  loop
    exit when v_remaining <= 0.00001;
    v_take := least(lot.qty, v_remaining);
    update material_lots set qty = qty - v_take where id = lot.id;
    v_cost := v_cost + v_take * coalesce(lot.cost, 0);
    v_remaining := v_remaining - v_take;
  end loop;

  delete from material_lots
  where material_id = p_material_id and qty <= 0.0001;

  if v_remaining > 0.00001 then
    v_cost := v_cost + v_remaining * coalesce(v_standard, 0);
  end if;

  update materials set stock = stock - p_qty where id = p_material_id;
  insert into material_usage (material_id, date, qty, type)
  values (p_material_id, p_date, p_qty, p_type);

  return v_cost;
end;
$$;


--
-- Name: guard_product_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_product_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- The owner, and anything running as the service role with no session
  -- (the app's own server actions, which have already checked), pass through.
  if auth.uid() is null or is_owner() then
    return new;
  end if;

  if is_manager() then
    -- Availability only. Every other column is pinned to its old value.
    new.id := old.id;
    new.name := old.name;
    new.price := old.price;
    new.description := old.description;
    new.categories := old.categories;
    new.image_url := old.image_url;
    new.kind := old.kind;
    new.is_public := old.is_public;
    return new;
  end if;

  -- Staff may not change a product at all.
  raise exception 'Only a manager or the owner can change the menu';
end $$;


--
-- Name: guard_profile_privileges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_profile_privileges() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and not is_owner() then
    new.role := old.role;
    new.is_verified := old.is_verified;
    new.is_blocked := old.is_blocked;
    -- An offer is as privileged as the role it turns into. Writing your own
    -- would be a promotion you then accept from yourself.
    new.pending_role := old.pending_role;
    new.role_offered_at := old.role_offered_at;
    new.role_offered_by := old.role_offered_by;
  end if;
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: guard_review_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_review_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and not is_staff() then
    new.shop_reply := old.shop_reply;
    new.shop_replied_at := old.shop_replied_at;
    new.is_hidden := old.is_hidden;
    -- A review cannot change what kind of thing it is, or whose it is.
    new.source := old.source;
    new.customer_id := old.customer_id;
    new.author_name := old.author_name;
    new.relayed_by := old.relayed_by;
  end if;
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: guard_review_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_review_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and not is_staff() then
    new.shop_reply := null;
    new.shop_replied_at := null;
    new.is_hidden := false;
    -- Whatever arrived, this is a customer posting under their own account.
    new.source := 'customer';
    new.customer_id := auth.uid();
    new.author_name := null;
    new.relayed_by := null;
  end if;

  -- Stamp who typed it in, from the session rather than from the payload.
  if new.source = 'relayed' and new.relayed_by is null then
    new.relayed_by := auth.uid();
  end if;

  return new;
end;
$$;


--
-- Name: guard_shift_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_shift_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and not is_owner() then
    new.staff_id := old.staff_id;
    new.started_at := old.started_at;
    new.created_at := old.created_at;
    if old.ended_at is not null then
      -- A closed shift is a finished record. Reopening it, or moving the
      -- drawer count it was closed with, would erase exactly the number a
      -- shortfall is worked out from.
      new.ended_at := old.ended_at;
      new.closing_cash := old.closing_cash;
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


--
-- Name: has_bought_product(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_bought_product(p_product_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from orders o
    join order_lines l on l.order_id = o.id
    where o.customer_id = auth.uid()
      and o.status = 'completed'
      and l.product_id = p_product_id
  );
$$;


--
-- Name: has_completed_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_completed_order() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from orders
    where customer_id = auth.uid() and status = 'completed'
  );
$$;


--
-- Name: is_manager(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_manager() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('owner', 'manager')
  );
$$;


--
-- Name: is_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_owner() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'owner'
  );
$$;


--
-- Name: is_staff(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_staff() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('owner', 'manager', 'staff')
  );
$$;


--
-- Name: order_catalog_categories(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.order_catalog_categories(p_wanted text[] DEFAULT ARRAY['Noodles'::text, 'Mains'::text, 'Ji Pai'::text, 'Solo'::text, 'Burger'::text, 'Premium Sides'::text, 'Coffee'::text, 'Milktea'::text, 'Raspberry'::text, 'Soft drinks'::text, 'Drinks'::text]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  moved int;
begin
  -- Matched case-insensitively and ignoring spacing, so "Ji Pai", "Ji pai"
  -- and "JiPai" are the same category. These names were typed in by hand over
  -- months; expecting them to match a hardcoded list exactly is how a data
  -- migration quietly does nothing and reports success.
  with matched as (
    select
      c.name,
      c.sort_order,
      (
        select i
        from unnest(p_wanted) with ordinality as w(label, i)
        where lower(replace(w.label, ' ', '')) = lower(replace(c.name, ' ', ''))
        limit 1
      ) as named
    from catalog_categories c
  ),
  ranked as (
    select
      name,
      case
        when named is not null then named
        else
          -- Anything not named above keeps its existing place, after the ones
          -- that were. Adding a category later must not silently reshuffle
          -- the rest of the menu.
          --
          -- `partition by` is what makes re-running this a no-op. Numbering
          -- the unnamed rows across the whole table instead counts the named
          -- ones too, so their positions shift every run as the named rows
          -- move around them — the numbers churn forever and each run
          -- reports work it did not need to do.
          coalesce(array_length(p_wanted, 1), 0)
            + row_number() over (
                partition by (named is null) order by sort_order, name
              )
      end as position
    from matched
  )
  update catalog_categories c
     set sort_order = (r.position * 10)::int
    from ranked r
   where c.name = r.name
     and c.sort_order is distinct from (r.position * 10)::int;

  get diagnostics moved = row_count;
  return moved;
end $$;


--
-- Name: order_requirements(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.order_requirements(p_order_id text) RETURNS TABLE(ref_type text, ref_id text, qty numeric)
    LANGUAGE sql STABLE
    AS $$
  with
  ord as (select fulfillment from orders where id = p_order_id),
  -- Anything that isn't eaten here leaves in a box.
  packed as (select (select fulfillment from ord) <> 'dine_in' as yes),
  tree as (
    with recursive product_tree as (
      select ol.product_id, ol.qty::numeric as mult, 0 as depth
      from order_lines ol
      where ol.order_id = p_order_id
      union all
      select mc.component_product_id, mt.mult * mc.qty, mt.depth + 1
      from product_tree mt
      join product_components mc on mc.product_id = mt.product_id
      where mt.depth < 5
    )
    select product_id, mult from product_tree
  ),
  food as (
    select mi.ref_type, mi.ref_id, sum(mi.qty * t.mult)::numeric as qty
    from tree t
    join product_materials mi on mi.product_id = t.product_id
    group by mi.ref_type, mi.ref_id
  ),
  /* Packaging follows the product that was ordered, so a bundle's packaging
     is the bundle's own — not one box per component inside it. */
  product_packaging_cost as (
    select mp.ref_type, mp.ref_id, sum(mp.qty * ol.qty)::numeric as qty
    from order_lines ol
    join product_packaging mp on mp.product_id = ol.product_id
    where ol.order_id = p_order_id and (select yes from packed)
    group by mp.ref_type, mp.ref_id
  ),
  /* Once per order, not once per line. */
  per_order as (
    select op.ref_type, op.ref_id, op.qty::numeric as qty
    from order_packaging op
    where (select yes from packed)
      and exists (select 1 from order_lines where order_id = p_order_id)
  )
  select ref_type, ref_id, sum(qty)::numeric
  from (
    select * from food
    union all select * from product_packaging_cost
    union all select * from per_order
  ) all_lines
  group by ref_type, ref_id;
$$;


--
-- Name: produce_run(text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.produce_run(p_production_run_id text, p_multiplier numeric) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
declare
  v_yield numeric;
  v_manual numeric;
  v_cost numeric := 0;
  v_lines int := 0;
  ing record;
begin
  if p_multiplier is null or p_multiplier <= 0 then
    raise exception 'How many production_runs? Must be more than zero.';
  end if;

  select yield_qty, manual_cost_per_unit into v_yield, v_manual
  from production_runs where id = p_production_run_id;
  if not found then
    raise exception 'That production_run no longer exists.';
  end if;
  if v_yield is null or v_yield <= 0 then
    raise exception 'This production_run has no yield set, so there is no amount to add.';
  end if;

  for ing in
    select material_id, qty from production_run_materials where production_run_id = p_production_run_id
  loop
    v_cost := v_cost + consume_material(
      ing.material_id, ing.qty * p_multiplier, current_date, 'production_run'
    );
    v_lines := v_lines + 1;
  end loop;

  -- A repack has no recipe by design: it is a bought item split into
  -- portions, and its cost is typed in rather than derived. Producing one
  -- would consume nothing and cost nothing, which is not a production_run being made —
  -- it is a number being invented.
  if v_lines = 0 and v_manual is null then
    raise exception 'This production_run has no recipe yet, so there is nothing to make it from.';
  end if;

  update production_runs
  set run_stock = run_stock + (v_yield * p_multiplier)
  where id = p_production_run_id;

  return round(v_cost, 2);
end;
$$;


--
-- Name: record_error(text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_error(p_fingerprint text, p_message text, p_route text, p_kind text, p_digest text, p_stack text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  is_new boolean;
begin
  insert into error_log (fingerprint, message, route, kind, digest, stack)
  values (p_fingerprint, p_message, p_route, p_kind, p_digest, p_stack)
  on conflict (fingerprint) do update
    set times = error_log.times + 1,
        last_seen = now(),
        -- A fault that recurs after being ticked off is open again. Silently
        -- staying resolved is how a known bug becomes an invisible one.
        resolved = false,
        resolved_at = null,
        stack = coalesce(excluded.stack, error_log.stack),
        digest = coalesce(excluded.digest, error_log.digest)
  returning (xmax = 0) into is_new;

  -- A hard ceiling, for the one case grouping does not cover: a message that
  -- embeds something unbounded makes every occurrence a new row. Oldest-last-
  -- seen first, and resolved rows before open ones, so what survives is what
  -- still needs attention.
  delete from error_log
  where id in (
    select id from error_log
    order by resolved asc, last_seen desc
    offset 500
  );

  return is_new;
end;
$$;


--
-- Name: regrant_visible_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.regrant_visible_columns() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  spec record;
  cols text;
begin
  -- One row per table that hides money from browser-side sessions, with the
  -- columns that stay behind the wall.
  for spec in
    select 'orders'::text as tbl,
           array['cogs','oe','gross_profit','net_profit']::text[] as hidden
    union all
    select 'waste'::text,
           array['cost_at_time','total_cost']::text[]
  loop
    if not exists (select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = spec.tbl) then
      continue;
    end if;

    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into cols
    from information_schema.columns
    where table_schema = 'public'
      and table_name = spec.tbl
      and not (column_name = any (spec.hidden));

    -- Table grant off first, then the columns back. A column-level REVOKE
    -- cannot carve a hole in a whole-table GRANT: the two are tracked
    -- separately and the table-level privilege keeps answering yes.
    execute format('revoke select on %I from anon, authenticated', spec.tbl);
    execute format('grant select (%s) on %I to anon, authenticated', cols, spec.tbl);
  end loop;
end $$;


--
-- Name: require_open_shift(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_open_shift() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  allowed boolean := true;
begin
  if auth.uid() is not null and is_staff() and not is_owner() then
    allowed := exists (
      select 1 from staff_shifts
      where staff_id = auth.uid() and ended_at is null
    );
  end if;

  if not allowed then
    -- 42501 is insufficient_privilege, which is what this is: the person may
    -- do this, just not right now.
    raise exception 'Not clocked in. Start a shift before changing anything — the shift is what puts your name on it.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;


--
-- Name: restore_material(text, numeric, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_material(p_material_id text, p_qty numeric, p_date date, p_type text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_cost numeric;
begin
  if p_qty is null or p_qty <= 0 then return; end if;
  select cost into v_cost from materials where id = p_material_id;
  if not found then return; end if;

  insert into material_lots (material_id, qty, cost, received_date)
  values (p_material_id, p_qty, coalesce(v_cost, 0), p_date);
  update materials set stock = stock + p_qty where id = p_material_id;
  -- Logged as a negative so the consumption history nets out. A cancelled
  -- order that left a positive row behind would inflate every usage average
  -- and, through those, every reorder suggestion.
  insert into material_usage (material_id, date, qty, type)
  values (p_material_id, p_date, -p_qty, p_type);
end;
$$;


--
-- Name: reverse_order_stock(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reverse_order_stock(p_order_id text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
declare
  v_date date;
  req record;
begin
  update orders
  set stock_applied_at = null
  where id = p_order_id and stock_applied_at is not null
  returning date into v_date;

  if not found then
    return false; -- never applied, so there is nothing to give back
  end if;

  for req in select * from order_requirements(p_order_id) loop
    if req.ref_type = 'inv' then
      perform restore_material(req.ref_id, req.qty, v_date, 'cancel');
    elsif req.ref_type = 'production_run' then
      update production_runs set run_stock = run_stock + req.qty where id = req.ref_id;
    end if;
  end loop;

  update orders set cogs = 0, gross_profit = 0 where id = p_order_id;
  return true;
end;
$$;


--
-- Name: submit_payment_reference(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_payment_reference(p_order_id text, p_reference text, p_receipt_url text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_owner uuid;
  v_status text;
  v_payment_status text;
  v_existing_receipt text;
  v_reference text := nullif(btrim(p_reference), '');
begin
  select customer_id, status, payment_status, payment_receipt_url
    into v_owner, v_status, v_payment_status, v_existing_receipt
  from orders where id = p_order_id;

  if v_owner is null or v_owner <> auth.uid() then
    return false;                            -- not yours (or a walk-in order)
  end if;
  if v_status = 'cancelled' then
    return false;                            -- nothing left to pay for
  end if;
  if v_payment_status in ('partial', 'paid') then
    return false;                            -- already confirmed by the shop
  end if;

  -- At least one form of proof, counting a screenshot already on file.
  if v_reference is null
     and p_receipt_url is null
     and v_existing_receipt is null then
    return false;
  end if;

  update orders
     set payment_reference   = coalesce(v_reference, payment_reference),
         payment_receipt_url = coalesce(p_receipt_url, payment_receipt_url),
         payment_status      = 'submitted'
   where id = p_order_id;

  return true;
end;
$$;


--
-- Name: sync_order_ticket_seq(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_order_ticket_seq() RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  top bigint;
begin
  select coalesce(max(ticket), 0) into top from orders;
  if top > 0 then
    perform setval('order_ticket_seq', top, true);
  else
    perform setval('order_ticket_seq', 1, false);
  end if;
  return top;
end $$;


--
-- Name: touch_announcement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_announcement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


--
-- Name: touch_order_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_order_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    category text,
    description text NOT NULL,
    undoable boolean DEFAULT false NOT NULL,
    undone boolean DEFAULT false NOT NULL,
    undo_type text,
    undo_data jsonb,
    actor uuid
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id bigint NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    body text,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text,
    video_url text,
    pinned boolean DEFAULT false NOT NULL,
    CONSTRAINT announcements_kind_check CHECK ((kind = ANY (ARRAY['promo'::text, 'news'::text, 'dine_in'::text, 'coming_soon'::text])))
);


--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    bought_on date,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: production_run_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_run_materials (
    id bigint NOT NULL,
    production_run_id text NOT NULL,
    material_id text NOT NULL,
    qty numeric NOT NULL
);


--
-- Name: production_run_materials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.production_run_materials_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: production_run_materials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.production_run_materials_id_seq OWNED BY public.production_run_materials.id;


--
-- Name: cash_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_ledger (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    type text NOT NULL,
    amount numeric NOT NULL,
    note text,
    logged_by text,
    category text,
    source text,
    ref_id text,
    CONSTRAINT cash_ledger_type_check CHECK ((type = ANY (ARRAY['in'::text, 'out'::text])))
);


--
-- Name: catalog_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_categories (
    name text NOT NULL,
    colour text DEFAULT 'ink'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id bigint NOT NULL,
    thread_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'staff'::text])))
);

ALTER TABLE ONLY public.chat_messages REPLICA IDENTITY FULL;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: chat_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_settings (
    id smallint DEFAULT 1 NOT NULL,
    messenger_url text,
    page_id text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_settings_id_check CHECK ((id = 1))
);


--
-- Name: chat_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    guest_key text,
    channel text DEFAULT 'web'::text NOT NULL,
    external_id text,
    contact_name text,
    contact_phone text,
    needs_human boolean DEFAULT false NOT NULL,
    handled boolean DEFAULT false NOT NULL,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    handled_at timestamp with time zone,
    taken_over boolean DEFAULT false NOT NULL,
    taken_over_at timestamp with time zone,
    CONSTRAINT chat_threads_channel_check CHECK ((channel = ANY (ARRAY['web'::text, 'messenger'::text])))
);

ALTER TABLE ONLY public.chat_threads REPLICA IDENTITY FULL;


--
-- Name: order_ticket_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_ticket_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    customer_id uuid,
    logged_by text,
    status text DEFAULT 'pending'::text NOT NULL,
    fulfillment text DEFAULT 'pickup'::text NOT NULL,
    payment_method text DEFAULT 'cod'::text NOT NULL,
    contact_name text,
    contact_phone text,
    notes text,
    tag text,
    revenue numeric DEFAULT 0 NOT NULL,
    cogs numeric DEFAULT 0 NOT NULL,
    oe numeric DEFAULT 0 NOT NULL,
    gross_profit numeric DEFAULT 0 NOT NULL,
    net_profit numeric DEFAULT 0 NOT NULL,
    eta_minutes integer,
    cancelled_reason text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    delivery_address text,
    delivery_lat double precision,
    delivery_lng double precision,
    delivery_distance_km numeric,
    delivery_fee numeric DEFAULT 0 NOT NULL,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    payment_reference text,
    payment_receipt_url text,
    paid_at timestamp with time zone,
    payment_plan text DEFAULT 'full'::text NOT NULL,
    downpayment_amount numeric DEFAULT 0 NOT NULL,
    downpayment_confirmed_at timestamp with time zone,
    eta_set_at timestamp with time zone,
    scheduled_for timestamp with time zone,
    notified_status text,
    eta_alerted_at timestamp with time zone,
    stock_applied_at timestamp with time zone,
    shift_id text,
    ticket bigint DEFAULT nextval('public.order_ticket_seq'::regclass) NOT NULL,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    CONSTRAINT orders_fulfillment_check CHECK ((fulfillment = ANY (ARRAY['pickup'::text, 'delivery'::text, 'dine_in'::text]))),
    CONSTRAINT orders_payment_plan_check CHECK ((payment_plan = ANY (ARRAY['full'::text, 'downpayment'::text]))),
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'submitted'::text, 'partial'::text, 'paid'::text, 'refunded'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text, 'out_for_delivery'::text, 'completed'::text, 'cancelled'::text])))
);

ALTER TABLE ONLY public.orders REPLICA IDENTITY FULL;


--
-- Name: customer_order_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.customer_order_stats WITH (security_invoker='true') AS
 SELECT customer_id,
    (count(*))::integer AS order_count,
    (count(*) FILTER (WHERE (status = 'completed'::text)))::integer AS completed_count,
    COALESCE(sum(revenue) FILTER (WHERE (status = 'completed'::text)), (0)::numeric) AS total_spent
   FROM public.orders
  WHERE (customer_id IS NOT NULL)
  GROUP BY customer_id;


--
-- Name: cycle_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cycle_counts (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: delivery_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_settings (
    id smallint DEFAULT 1 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    shop_lat double precision DEFAULT 14.9508 NOT NULL,
    shop_lng double precision DEFAULT 120.7581 NOT NULL,
    base_fee numeric DEFAULT 30 NOT NULL,
    base_km numeric DEFAULT 2 NOT NULL,
    per_km_fee numeric DEFAULT 10 NOT NULL,
    min_fee numeric DEFAULT 30 NOT NULL,
    max_km numeric DEFAULT 10 NOT NULL,
    free_over numeric DEFAULT 0 NOT NULL,
    notice text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_settings_id_check CHECK ((id = 1))
);


--
-- Name: device_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_sessions (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    user_id uuid NOT NULL,
    device_id text NOT NULL,
    label text,
    status text DEFAULT 'pending'::text NOT NULL,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    decided_by uuid,
    CONSTRAINT device_sessions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])))
);


--
-- Name: error_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.error_log (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    fingerprint text NOT NULL,
    message text NOT NULL,
    route text,
    kind text DEFAULT 'server'::text NOT NULL,
    digest text,
    stack text,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    times integer DEFAULT 1 NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone
);


--
-- Name: faq_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faq_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    triggers text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    hits integer DEFAULT 0 NOT NULL,
    priority smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    show_on_site boolean DEFAULT false NOT NULL,
    site_order integer DEFAULT 0 NOT NULL
);


--
-- Name: fixed_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixed_costs (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    label text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: material_lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_lots (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    material_id text NOT NULL,
    qty numeric NOT NULL,
    cost numeric DEFAULT 0 NOT NULL,
    received_date date,
    expiry_date date
);


--
-- Name: material_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_usage (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    material_id text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    qty numeric NOT NULL,
    type text
);


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    purchase_price numeric DEFAULT 0 NOT NULL,
    purchase_qty numeric DEFAULT 0 NOT NULL,
    categories text[] DEFAULT '{}'::text[] NOT NULL,
    cost numeric DEFAULT 0 NOT NULL,
    stock numeric DEFAULT 0 NOT NULL,
    reorder numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_components (
    id bigint NOT NULL,
    product_id text NOT NULL,
    component_product_id text NOT NULL,
    qty numeric NOT NULL
);


--
-- Name: product_components_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_components_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_components_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_components_id_seq OWNED BY public.product_components.id;


--
-- Name: product_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_materials (
    id bigint NOT NULL,
    product_id text NOT NULL,
    ref_type text NOT NULL,
    ref_id text NOT NULL,
    qty numeric NOT NULL,
    CONSTRAINT product_materials_ref_type_check CHECK ((ref_type = ANY (ARRAY['inv'::text, 'production_run'::text])))
);


--
-- Name: product_materials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_materials_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_materials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_materials_id_seq OWNED BY public.product_materials.id;


--
-- Name: product_packaging; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_packaging (
    id bigint NOT NULL,
    product_id text NOT NULL,
    ref_type text NOT NULL,
    ref_id text NOT NULL,
    qty numeric NOT NULL,
    CONSTRAINT product_packaging_ref_type_check CHECK ((ref_type = ANY (ARRAY['inv'::text, 'production_run'::text])))
);


--
-- Name: product_packaging_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_packaging_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_packaging_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_packaging_id_seq OWNED BY public.product_packaging.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    product_id text,
    order_id text,
    rating smallint NOT NULL,
    comment text,
    shop_reply text,
    shop_replied_at timestamp with time zone,
    is_hidden boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    author_name text,
    source text DEFAULT 'customer'::text NOT NULL,
    relayed_by uuid,
    CONSTRAINT reviews_author_shape CHECK ((((source = 'customer'::text) AND (customer_id IS NOT NULL)) OR ((source = 'relayed'::text) AND (customer_id IS NULL) AND (author_name IS NOT NULL) AND (length(btrim(author_name)) > 0)))),
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT reviews_source_check CHECK ((source = ANY (ARRAY['customer'::text, 'relayed'::text])))
);


--
-- Name: product_ratings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.product_ratings WITH (security_invoker='on') AS
 SELECT product_id AS product_id,
    round(avg(rating), 2) AS avg_rating,
    (count(*))::integer AS review_count
   FROM public.reviews
  WHERE ((product_id IS NOT NULL) AND (NOT is_hidden))
  GROUP BY product_id;


--
-- Name: oe_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oe_templates (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_lines (
    id bigint NOT NULL,
    order_id text NOT NULL,
    product_id text NOT NULL,
    qty numeric NOT NULL,
    price_at_sale numeric NOT NULL
);


--
-- Name: order_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_lines_id_seq OWNED BY public.order_lines.id;


--
-- Name: order_packaging; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_packaging (
    id bigint NOT NULL,
    ref_type text NOT NULL,
    ref_id text NOT NULL,
    qty numeric NOT NULL,
    CONSTRAINT order_packaging_ref_type_check CHECK ((ref_type = ANY (ARRAY['inv'::text, 'production_run'::text])))
);


--
-- Name: order_packaging_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_packaging_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_packaging_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_packaging_id_seq OWNED BY public.order_packaging.id;


--
-- Name: orders_for_staff; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.orders_for_staff WITH (security_invoker='true') AS
 SELECT id,
    created_at,
    date,
    customer_id,
    status,
    fulfillment,
    scheduled_for,
    contact_name,
    contact_phone,
    notes,
    tag,
    logged_by,
    shift_id,
    delivery_address,
    delivery_lat,
    delivery_lng,
    delivery_distance_km,
    delivery_fee,
    revenue,
    eta_minutes,
    eta_set_at,
    cancelled_reason,
    payment_status,
    payment_method,
    payment_plan,
    payment_reference,
    payment_receipt_url,
    downpayment_amount,
    downpayment_confirmed_at,
    paid_at
   FROM public.orders;


--
-- Name: payment_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_settings (
    id smallint DEFAULT 1 NOT NULL,
    cod_enabled boolean DEFAULT true NOT NULL,
    gcash_enabled boolean DEFAULT false NOT NULL,
    gcash_name text,
    gcash_number text,
    gcash_qr_url text,
    instructions text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    downpayment_enabled boolean DEFAULT false NOT NULL,
    downpayment_percent numeric DEFAULT 50 NOT NULL,
    CONSTRAINT payment_settings_downpayment_percent_check CHECK (((downpayment_percent > (0)::numeric) AND (downpayment_percent < (100)::numeric))),
    CONSTRAINT payment_settings_id_check CHECK ((id = 1))
);


--
-- Name: production_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_runs (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    yield_qty numeric DEFAULT 0 NOT NULL,
    yield_unit text DEFAULT 'g'::text NOT NULL,
    run_stock numeric DEFAULT 0 NOT NULL,
    reorder_level numeric DEFAULT 0 NOT NULL,
    manual_cost_per_unit numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    kind text DEFAULT 'single'::text NOT NULL,
    categories text[] DEFAULT '{}'::text[] NOT NULL,
    description text,
    image_url text,
    is_public boolean DEFAULT true NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_kind_check CHECK ((kind = ANY (ARRAY['single'::text, 'combo'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role text DEFAULT 'customer'::text NOT NULL,
    full_name text,
    phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    address text,
    is_verified boolean DEFAULT false NOT NULL,
    is_blocked boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    address_lat double precision,
    address_lng double precision,
    pending_role text,
    role_offered_at timestamp with time zone,
    role_offered_by uuid,
    avatar_url text,
    CONSTRAINT profiles_pending_role_check CHECK (((pending_role IS NULL) OR (pending_role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text])))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text, 'customer'::text])))
);


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchases (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    material_id text NOT NULL,
    lot_id text,
    date date DEFAULT CURRENT_DATE NOT NULL,
    supplier text,
    qty numeric NOT NULL,
    cost numeric NOT NULL,
    logged_by text
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_sent_at timestamp with time zone
);


--
-- Name: receivables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receivables (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    customer text,
    amount numeric NOT NULL,
    collected boolean DEFAULT false NOT NULL,
    note text,
    amount_collected numeric DEFAULT 0 NOT NULL,
    phone text
);


--
-- Name: restore_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restore_snapshots (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    taken_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text NOT NULL,
    rows_included integer DEFAULT 0 NOT NULL,
    bytes integer DEFAULT 0 NOT NULL,
    payload text NOT NULL,
    automatic boolean DEFAULT false NOT NULL
);


--
-- Name: review_authors; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.review_authors AS
 SELECT id,
    full_name,
    avatar_url
   FROM public.profiles p
  WHERE (EXISTS ( SELECT 1
           FROM public.reviews r
          WHERE ((r.customer_id = p.id) AND (NOT r.is_hidden))));


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id smallint DEFAULT 1 NOT NULL,
    open_days_per_month integer DEFAULT 26 NOT NULL,
    cash_reserve numeric DEFAULT 0 NOT NULL,
    promo_tags text[] DEFAULT '{}'::text[] NOT NULL,
    cash_balance_enabled boolean DEFAULT false NOT NULL,
    cash_balance_starting_amount numeric DEFAULT 0 NOT NULL,
    cash_balance_start_date date,
    logged_by_names text[] DEFAULT '{}'::text[] NOT NULL,
    last_backup_date timestamp with time zone,
    payback_from date,
    offsite_backup_enabled boolean DEFAULT false NOT NULL,
    offsite_backup_email text,
    offsite_backup_last_at timestamp with time zone,
    offsite_backup_last_error text,
    CONSTRAINT settings_id_check CHECK ((id = 1))
);


--
-- Name: shop_closures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_closures (
    closed_on date NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shop_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_hours (
    weekday smallint NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    opens time without time zone DEFAULT '10:00:00'::time without time zone NOT NULL,
    closes time without time zone DEFAULT '21:00:00'::time without time zone NOT NULL,
    CONSTRAINT shop_hours_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);


--
-- Name: shop_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_settings (
    id smallint DEFAULT 1 NOT NULL,
    accepting_orders boolean DEFAULT true NOT NULL,
    paused_message text,
    min_lead_hours smallint DEFAULT 2 NOT NULL,
    max_days_ahead smallint DEFAULT 14 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shop_settings_id_check CHECK ((id = 1)),
    CONSTRAINT shop_settings_max_days_ahead_check CHECK (((max_days_ahead >= 1) AND (max_days_ahead <= 90))),
    CONSTRAINT shop_settings_min_lead_hours_check CHECK (((min_lead_hours >= 0) AND (min_lead_hours <= 168)))
);


--
-- Name: waste; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waste (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    material_id text,
    qty numeric NOT NULL,
    unit text,
    reason text,
    cost_at_time numeric,
    total_cost numeric,
    category text DEFAULT 'internal'::text,
    source_type text,
    source_id text,
    source_name text,
    note text,
    logged_by text,
    CONSTRAINT waste_source_type_check CHECK (((source_type IS NULL) OR (source_type = ANY (ARRAY['inv'::text, 'production_run'::text, 'product'::text]))))
);


--
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: order_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_lines ALTER COLUMN id SET DEFAULT nextval('public.order_lines_id_seq'::regclass);


--
-- Name: order_packaging id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packaging ALTER COLUMN id SET DEFAULT nextval('public.order_packaging_id_seq'::regclass);


--
-- Name: product_components id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_components ALTER COLUMN id SET DEFAULT nextval('public.product_components_id_seq'::regclass);


--
-- Name: product_materials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_materials ALTER COLUMN id SET DEFAULT nextval('public.product_materials_id_seq'::regclass);


--
-- Name: product_packaging id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_packaging ALTER COLUMN id SET DEFAULT nextval('public.product_packaging_id_seq'::regclass);


--
-- Name: production_run_materials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_run_materials ALTER COLUMN id SET DEFAULT nextval('public.production_run_materials_id_seq'::regclass);


