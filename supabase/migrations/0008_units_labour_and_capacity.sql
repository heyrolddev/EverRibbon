--
-- What a thing is sold by, what it costs in time, and how much time there is.
--
-- Three gaps the food shop never had to think about:
--
-- UNITS. Servings are whole things, so quantity was an integer capped at 99.
-- Ribbon is sold by the yard and a bouquet is a piece; a shop that sells both
-- needs the product to say which, and whether half of one is a real order.
--
-- LABOUR. It sat in operating expenses, which is right when every serving
-- takes about the same time and wrong the moment one product takes nine hours
-- of run work and another takes two minutes. Put both in overheads and the
-- slow one looks more profitable than it is, and gets priced accordingly.
--
-- The shape that fits how the work actually happens is two numbers, not one.
-- Components are made in runs ahead of demand -- cut, fold, assemble --
-- so a run records the minutes it took and its yield divides them. Finished
-- goods are assembled per order, so the product records that separately. The
-- cost of a flower then comes from a run that really happened rather than
-- from a figure somebody estimated once, and it corrects itself as the maker
-- gets faster.
--
-- CAPACITY. A calendar that counts orders per day oversells a shop whose
-- limit is hours. Minutes are the unit that is actually scarce.
--
-- Everything here is a column or a setting, never a constant: the owner
-- changes their rate, their day, and their consumables without a deploy.
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path TO '';
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

-- ---------------------------------------------------------------- products --

ALTER TABLE public.products
  -- What one of these is. Free text rather than an enum because the next shop
  -- sells something nobody here has thought of.
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'piece' NOT NULL,
  -- Whether half of one is a real order. False for a bouquet, true for ribbon
  -- sold by the yard.
  ADD COLUMN IF NOT EXISTS allow_fractional boolean DEFAULT false NOT NULL,
  -- Minutes to put one together once its components exist. The per-order half
  -- of labour; the run half lives on production_runs below.
  ADD COLUMN IF NOT EXISTS assembly_minutes numeric DEFAULT 0 NOT NULL;

ALTER TABLE public.products
  ADD CONSTRAINT products_assembly_minutes_check CHECK (assembly_minutes >= 0),
  ADD CONSTRAINT products_unit_check CHECK (btrim(unit) <> '');

-- ---------------------------------------------------------- production runs --

ALTER TABLE public.production_runs
  -- Minutes for one full run, whatever its yield. Divided by yield_qty to
  -- cost a single component, so a shop that records "nine hours made a
  -- hundred flowers" never has to estimate the per-flower figure again.
  ADD COLUMN IF NOT EXISTS labour_minutes numeric DEFAULT 0 NOT NULL;

ALTER TABLE public.production_runs
  ADD CONSTRAINT production_runs_labour_minutes_check CHECK (labour_minutes >= 0);

-- --------------------------------------------------------------- settings --

ALTER TABLE public.shop_settings
  -- The ceiling the calendar measures a day against. Hours of work, not a
  -- count of orders.
  ADD COLUMN IF NOT EXISTS capacity_minutes_per_day integer DEFAULT 600 NOT NULL,
  -- What an hour of the maker's time is worth. Zero means labour is not
  -- costed, which is the honest default for a shop that has not decided.
  ADD COLUMN IF NOT EXISTS labour_rate_per_hour numeric DEFAULT 0 NOT NULL,
  -- Glue, tape, the small things. Split per unit and per order because they
  -- scale differently, and kept out of COGS-by-another-name: this is not the
  -- place for rent or power, which belong in operating expenses.
  ADD COLUMN IF NOT EXISTS consumables_per_unit numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS consumables_per_order numeric DEFAULT 0 NOT NULL,
  -- How long after a deal is agreed the deposit stays refundable.
  --
  -- Keyed to the moment work starts rather than counted back from the due
  -- date, because the irreversible act is cutting stock, not the calendar
  -- turning. A shop that starts within the hour and one that starts the night
  -- before are both served by the same number.
  ADD COLUMN IF NOT EXISTS deposit_cooling_off_minutes integer DEFAULT 0 NOT NULL,
  -- A near date is offered with a surcharge, never refused: a rush is a
  -- conversation, and a calendar that simply blocks it loses the order.
  ADD COLUMN IF NOT EXISTS rush_window_days smallint DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS rush_fee_percent numeric DEFAULT 0 NOT NULL;

ALTER TABLE public.shop_settings
  ADD CONSTRAINT shop_settings_capacity_check CHECK (capacity_minutes_per_day BETWEEN 0 AND 1440),
  ADD CONSTRAINT shop_settings_labour_rate_check CHECK (labour_rate_per_hour >= 0),
  ADD CONSTRAINT shop_settings_consumables_check CHECK (consumables_per_unit >= 0 AND consumables_per_order >= 0),
  ADD CONSTRAINT shop_settings_cooling_off_check CHECK (deposit_cooling_off_minutes >= 0),
  ADD CONSTRAINT shop_settings_rush_check CHECK (rush_window_days >= 0 AND rush_fee_percent >= 0 AND rush_fee_percent <= 200);

-- ------------------------------------------------------------ the calendar --

--
-- Minutes already committed on a given day.
--
-- Counts assembly time for open orders only: a cancelled order is not work,
-- and a completed one has already been done. Component time is deliberately
-- excluded -- that is replenishment, scheduled against stock rather than
-- against a customer's date, and counting it here would make the calendar
-- refuse work the shop can actually take.
--
CREATE OR REPLACE FUNCTION public.minutes_booked(p_day date)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select coalesce(sum(ol.qty * p.assembly_minutes), 0)::numeric
  from orders o
  join order_lines ol on ol.order_id = o.id
  join products p on p.id = ol.product_id
  join order_statuses s on s.key = o.status
  where s.is_open
    and coalesce(o.scheduled_for::date, o.date) = p_day;
$$;

REVOKE ALL ON FUNCTION public.minutes_booked(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.minutes_booked(date) TO authenticated;
