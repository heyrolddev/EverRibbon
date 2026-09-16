--
-- 0013 — a line that is not a catalogue product, and the quote around it.
--
-- The schema so far assumes every order line points at a product: `product_id`
-- is NOT NULL and references `products`. That is true of a shop that sells
-- from a list, and false of one that makes to order — where the first thing a
-- customer says is "three stems, ivory and gold, with her name on the ribbon",
-- and no row in `products` has ever described it.
--
-- The alternative would have been a product row per enquiry. That is how a
-- catalogue ends up with four hundred entries, one customer each, none of them
-- for sale, and a menu screen nobody can use.
--
-- Nothing here drops or rewrites anything. A line that names a product still
-- names a product, and every existing row is untouched.
--

-- --------------------------------------------------------------- the lines --

ALTER TABLE public.order_lines
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.order_lines
  -- What this is, in the words the customer used. Set only when the line is
  -- not a catalogue product; a product's name is the product's to change.
  ADD COLUMN IF NOT EXISTS label text,
  -- The answers that make it what it is: stems, colours, ribbon width, the
  -- text to print. Free-form on purpose — a ribbon shop and a cake shop do
  -- not ask the same questions, and a column per question is a migration
  -- every time the shop learns a new one.
  ADD COLUMN IF NOT EXISTS spec jsonb,
  -- Minutes to make ONE, when there is no product carrying `assembly_minutes`.
  -- This is what the capacity calendar books against the due date.
  ADD COLUMN IF NOT EXISTS labour_minutes numeric,
  -- What one costs the shop, as quoted. Kept on the line rather than
  -- recomputed later: the cost of ribbon moves, and the margin on a job is
  -- the margin that was true when it was agreed.
  ADD COLUMN IF NOT EXISTS unit_cost numeric;

ALTER TABLE public.order_lines
  -- A line is either a product or a description. Neither leaves a row that
  -- prints as a blank on the receipt and cannot be costed.
  ADD CONSTRAINT order_lines_identified
    CHECK (product_id IS NOT NULL OR btrim(coalesce(label, '')) <> ''),
  ADD CONSTRAINT order_lines_labour_minutes_check
    CHECK (labour_minutes IS NULL OR labour_minutes >= 0),
  ADD CONSTRAINT order_lines_unit_cost_check
    CHECK (unit_cost IS NULL OR unit_cost >= 0);

-- -------------------------------------------------------------- the quote --

ALTER TABLE public.orders
  -- When the price was put to the customer. Distinct from `created_at`: an
  -- enquiry can sit for a week before anyone works out what it costs.
  ADD COLUMN IF NOT EXISTS quoted_at timestamp with time zone,
  -- Ribbon is bought by the roll at a price that moves, and a quote with no
  -- end on it is a promise to honour last month's cost.
  ADD COLUMN IF NOT EXISTS quote_valid_until date,
  -- The surcharge for a date inside the rush window. Its own column rather
  -- than folded into revenue, because "we were paid extra to hurry" is a
  -- different fact from "we sold more", and only one of them is repeatable.
  ADD COLUMN IF NOT EXISTS rush_fee numeric DEFAULT 0 NOT NULL,
  -- The target the prices on this quote were derived from, so a quote
  -- reopened next month rebuilds at the number it was written with rather
  -- than at whatever the settings say today.
  ADD COLUMN IF NOT EXISTS uplift_kind text,
  ADD COLUMN IF NOT EXISTS uplift_percent numeric;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_rush_fee_check CHECK (rush_fee >= 0),
  ADD CONSTRAINT orders_uplift_kind_check
    CHECK (uplift_kind IS NULL OR uplift_kind = ANY (ARRAY['margin'::text, 'markup'::text])),
  ADD CONSTRAINT orders_uplift_percent_check
    CHECK (uplift_percent IS NULL OR (uplift_percent >= 0 AND uplift_percent < 1000));

-- Finding the quotes that are about to lapse is the one query this table gets
-- asked that it cannot already answer quickly.
CREATE INDEX IF NOT EXISTS orders_quote_valid_until_idx
  ON public.orders (quote_valid_until)
  WHERE quote_valid_until IS NOT NULL;

-- ------------------------------------------------------------ the calendar --

--
-- Minutes already committed on a given day.
--
-- Replaces the 0008 version, which joined `products` INNER. Every custom line
-- has no product, so under that join a day could fill with bouquets and still
-- report itself empty — the calendar would have gone on accepting work that
-- was already sold. This counts the line's own `labour_minutes` first and
-- falls back to the product's, so a catalogue shop behaves exactly as before.
--
CREATE OR REPLACE FUNCTION public.minutes_booked(p_day date)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select coalesce(
           sum(ol.qty * coalesce(ol.labour_minutes, p.assembly_minutes, 0)),
           0
         )::numeric
  from orders o
  join order_lines ol on ol.order_id = o.id
  left join products p on p.id = ol.product_id
  join order_statuses s on s.key = o.status
  where s.is_open
    and coalesce(o.scheduled_for::date, o.date) = p_day;
$$;

REVOKE ALL ON FUNCTION public.minutes_booked(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.minutes_booked(date) TO authenticated;
