--
-- A stretch of days, and what is left in each.
--
-- minutes_booked() answers for one day, which is right for a check at
-- checkout and wrong for a calendar: a fortnight would be fourteen round
-- trips to draw one screen. This answers for a range in one.
--
-- It also returns the ceiling per row rather than leaving the caller to fetch
-- it separately, so a day can never be drawn against the wrong one.
--
-- Rest days are the reason `is_full` is not simply booked >= ceiling. A shop
-- closed on Sunday has a ceiling of zero minutes that day, and a zero ceiling
-- with zero booked is not a day with room -- it is a day the shop is not
-- working. Saying so here keeps every caller from having to remember it.
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path TO '';
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

CREATE OR REPLACE FUNCTION public.capacity_calendar(p_from date, p_to date)
RETURNS TABLE (
  day date,
  booked numeric,
  ceiling integer,
  free numeric,
  is_full boolean,
  is_closed boolean,
  orders integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  with bounds as (
    -- A request for a thousand years is a denial of service, not a calendar.
    select p_from as f, least(p_to, p_from + 366) as t
  ),
  days as (
    select generate_series(f, t, interval '1 day')::date as day from bounds
  ),
  cap as (
    select coalesce((select capacity_minutes_per_day from shop_settings where id = 1), 0) as ceiling
  ),
  closed as (
    select d.day,
           -- Closed either because the weekday is not a trading day, or
           -- because someone marked that specific date.
           coalesce(
             (select not h.is_open from shop_hours h where h.weekday = extract(dow from d.day)),
             false
           )
           or exists (select 1 from shop_closures c where c.closed_on = d.day) as shut
    from days d
  ),
  work as (
    select coalesce(o.scheduled_for::date, o.date) as day,
           sum(ol.qty * p.assembly_minutes)::numeric as booked,
           count(distinct o.id)::integer as orders
    from orders o
    join order_lines ol on ol.order_id = o.id
    join products p on p.id = ol.product_id
    join order_statuses s on s.key = o.status
    where s.is_open
      and coalesce(o.scheduled_for::date, o.date) between (select f from bounds) and (select t from bounds)
    group by 1
  )
  select
    d.day,
    coalesce(w.booked, 0) as booked,
    cap.ceiling,
    greatest(0, cap.ceiling - coalesce(w.booked, 0)) as free,
    (not cl.shut and coalesce(w.booked, 0) >= cap.ceiling) as is_full,
    cl.shut as is_closed,
    coalesce(w.orders, 0) as orders
  from days d
  cross join cap
  join closed cl on cl.day = d.day
  left join work w on w.day = d.day
  order by d.day;
$$;

REVOKE ALL ON FUNCTION public.capacity_calendar(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capacity_calendar(date, date) TO authenticated;
