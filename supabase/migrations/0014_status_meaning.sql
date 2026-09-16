--
-- 0014 — what a step MEANS, asked of the data instead of read off its name.
--
-- Migration 0007 made the steps rows, and 0011 added `commits_stock` after
-- the same mistake was found once: a list of status names hardcoded in the
-- app, doing semantic work, correct for exactly one shop.
--
-- It was found once more, and this time it reached the database. Two names
-- carry meaning across this system: 'completed' and 'cancelled'. A shop whose
-- steps run inquiry → quoted → agreed → deposit_paid → proof_sent → approved
-- → in_production → ready → balance_paid → delivered has neither 'completed'
-- nor anything the code recognises as it. Nothing errors. Instead:
--
--   * `customer_order_stats` reports every customer's lifetime spend as 0,
--     because `sum(revenue) FILTER (WHERE status = 'completed')` matches
--     nothing;
--   * `has_bought_product` and `has_completed_order` return false for
--     everyone, so no customer can ever leave a review;
--   * revenue, cost-of-sales and the dashboard all read zero on a shop that
--     is busy.
--
-- Every one of those looks like a quiet shop rather than a broken one, which
-- is why it survives.
--
-- So the steps grow two flags, and everything that used to match a name now
-- asks the question it actually meant.
--

ALTER TABLE public.order_statuses
  -- The goods reached the customer. Revenue is earned, it counts toward what
  -- they have spent with the shop, and it is a purchase they may review.
  ADD COLUMN IF NOT EXISTS is_fulfilled boolean DEFAULT false NOT NULL,
  -- It did not happen. Excluded from every count, and materials go back.
  ADD COLUMN IF NOT EXISTS is_cancellation boolean DEFAULT false NOT NULL,
  -- The ball is in the customer's court: waiting on a decision, a deposit,
  -- an approval, or for them to come and collect.
  --
  -- The dashboard's "needs you" tile was a hardcoded list of three step names.
  -- On any other shop's steps it matched nothing, so the board reported that
  -- nothing needed doing while every order in the place was waiting on
  -- somebody. Split this way it is right for both: what is waiting on the
  -- shop is everything open that is not waiting on them.
  ADD COLUMN IF NOT EXISTS awaiting_customer boolean DEFAULT false NOT NULL,
  -- What the CUSTOMER is told at this step, in the shop's own voice.
  --
  -- `hint` is written for whoever is running the shop. The customer's version
  -- was a separate map in the tracker component, in one shop's voice — "Your
  -- food is on the pan right now" — which is both wrong for the next shop and
  -- the kind of line an owner wants to change without a developer. Null falls
  -- back to the step's label, so a shop that writes none still has a working
  -- tracker.
  ADD COLUMN IF NOT EXISTS customer_note text;

-- A third column for "the goods change hands" was written and then removed:
-- it is the same step. Both shops' lists end the same way — 'completed' for
-- one, 'delivered' for the other — and both are the step where the customer
-- has the thing and the shop stops owing it. A separate flag would only have
-- been a second answer to one question, free to disagree with the first.

--
-- The shop's current steps, whichever set it is running.
--
-- Written as a match on what the row already says rather than on a fixed list
-- of names, so a shop that has seeded its own steps is described correctly
-- without this file having to know them: the last open step before the closed
-- ones is where the goods go, and a closed step that is not the cancellation
-- is fulfilment.
--
UPDATE public.order_statuses SET is_cancellation = true
  WHERE key IN ('cancelled', 'canceled', 'declined', 'lapsed');

UPDATE public.order_statuses SET is_fulfilled = true
  WHERE NOT is_open AND NOT is_cancellation;

-- Made and waiting to be collected is the one every shop has. A shop with
-- more of them — a quote out, a proof sent — marks its own; this only has to
-- be right about the obvious one rather than clever about the rest.
UPDATE public.order_statuses SET awaiting_customer = true
  WHERE is_open AND key IN ('ready', 'quoted', 'proof_sent', 'agreed');

-- A shop with no fulfilled step has an order board that can never report a
-- sale. Falling back to the last step by order is better than leaving it
-- unset, and a shop that disagrees changes one row.
UPDATE public.order_statuses SET is_fulfilled = true
  WHERE NOT EXISTS (SELECT 1 FROM public.order_statuses WHERE is_fulfilled)
    AND key = (
      SELECT key FROM public.order_statuses
      WHERE NOT is_cancellation ORDER BY sort_order DESC LIMIT 1
    );

-- The default steps get the words the tracker used to hardcode, so a shop on
-- them reads exactly as before and a shop on its own steps has somewhere to
-- put its own.
UPDATE public.order_statuses SET customer_note = v.note FROM (VALUES
  ('pending',          'We have your order — waiting for the shop to confirm.'),
  ('confirmed',        'Confirmed. It is in the queue.'),
  ('preparing',        'Being made right now.'),
  ('ready',            'Ready and waiting for you.'),
  ('out_for_delivery', 'On the way — keep your phone nearby.'),
  ('completed',        'All done. Thank you!'),
  ('cancelled',        'This order did not go ahead.')
) AS v(key, note)
WHERE order_statuses.key = v.key AND order_statuses.customer_note IS NULL;

-- ------------------------------------------------------------ the queries --

--
-- What a customer has spent here.
--
-- `security_invoker` is kept: the view must be read with the caller's rights,
-- or it becomes a way for one customer to total another's orders.
--
CREATE OR REPLACE VIEW public.customer_order_stats WITH (security_invoker='true') AS
 SELECT o.customer_id,
    (count(*))::integer AS order_count,
    (count(*) FILTER (WHERE s.is_fulfilled))::integer AS completed_count,
    COALESCE(sum(o.revenue) FILTER (WHERE s.is_fulfilled), (0)::numeric) AS total_spent
   FROM public.orders o
   JOIN public.order_statuses s ON s.key = o.status
  WHERE (o.customer_id IS NOT NULL)
  GROUP BY o.customer_id;

--
-- Has this customer actually bought this product?
--
-- The gate on writing a review. Answering "no" to everyone is not a visible
-- failure — the review form simply never appears, and a shop concludes its
-- customers do not review things.
--
CREATE OR REPLACE FUNCTION public.has_bought_product(p_product_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select exists (
    select 1
    from orders o
    join order_lines l on l.order_id = o.id
    join order_statuses s on s.key = o.status
    where o.customer_id = auth.uid()
      and s.is_fulfilled
      and l.product_id = p_product_id
  );
$$;

--
-- Has this customer completed an order at all?
--
CREATE OR REPLACE FUNCTION public.has_completed_order()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select exists (
    select 1
    from orders o
    join order_statuses s on s.key = o.status
    where o.customer_id = auth.uid() and s.is_fulfilled
  );
$$;
