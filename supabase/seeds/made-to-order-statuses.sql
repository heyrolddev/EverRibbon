--
-- The flow for a shop that agrees the work, takes a deposit, sends a proof and
-- only then builds.
--
-- Run this instead of the defaults in migration 0007 when a shop is
-- made-to-order. It is a seed rather than a migration because it is a shop's
-- own data: the next business will want its own steps, and neither list is
-- more correct than the other.
--
--   psql "$DATABASE_URL" -f supabase/seeds/made-to-order-statuses.sql
--
-- Safe to run on a shop with live orders only if every existing status still
-- appears below; the foreign key from orders.status will refuse otherwise,
-- which is the outcome you want rather than orphaned orders.
--

BEGIN;

DELETE FROM public.order_statuses
WHERE key NOT IN (SELECT DISTINCT status FROM public.orders WHERE status IS NOT NULL);

-- Every column that carries meaning is written here, including the ones added
-- after this file was: a seed that leaves them to their defaults is a seed
-- that reintroduces the bug the column was added to fix, on the next shop
-- that installs in a different order.
INSERT INTO public.order_statuses
  (key, label, sort_order, is_open, is_gate, delivery_only, tone, commits_stock,
   is_fulfilled, is_cancellation, awaiting_customer, hint, customer_note) VALUES
  ('inquiry',       'Inquiry',       10, true,  false, false, 'ink',    false, false, false, false, 'Someone asked. Nothing agreed yet.', 'We have your message. We will come back with a price.'),
  ('quoted',        'Quoted',        20, true,  false, false, 'ink',    false, false, false, true, 'A price is with the customer.', 'Your quote is with you — have a look and let us know.'),
  ('agreed',        'Agreed',        30, true,  true,  false, 'accent', false, false, false, true, 'Order, date and handover all settled. Waiting on the deposit.', 'Agreed. We will start once the deposit is in.'),
  ('deposit_paid',  'Deposit paid',  40, true,  false, false, 'ok',     true,  false, false, false, 'The deposit has arrived. Work can start.', 'Deposit received. You are booked in.'),
  ('proof_sent',    'Proof sent',    50, true,  true,  false, 'accent', true,  false, false, true, 'With the customer. Nothing is printed until they approve.', 'Your proof is with you. Nothing is made until you approve it.'),
  ('approved',      'Approved',      60, true,  false, false, 'ok',     true,  false, false, false, 'Approved. Build it.', 'Approved. Yours is going into production.'),
  ('in_production', 'In production', 70, true,  false, false, 'brand',  true,  false, false, false, 'Being made now.', 'Being made by hand right now.'),
  ('ready',         'Ready',         80, true,  false, false, 'ok',     true,  false, false, true, 'Finished. Waiting for the balance or for collection.', 'Finished and waiting for you.'),
  ('balance_paid',  'Balance paid',  90, true,  false, false, 'ok',     true,  false, false, false, 'Paid in full.', 'Paid in full. Thank you!'),
  -- The step where the customer has the thing. Revenue is earned here, it
  -- counts toward what they have spent, and it is what lets them review it.
  ('delivered',     'Delivered',    100, false, false, false, 'ink',    true,  true,  false, false, 'Handed over.', 'Handed over. We hope it is everything you wanted.'),
  ('cancelled',     'Cancelled',    110, false, false, false, 'bad',    false, false, true,  false, 'Did not happen.', 'This order did not go ahead.')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_open = EXCLUDED.is_open,
  is_gate = EXCLUDED.is_gate,
  delivery_only = EXCLUDED.delivery_only,
  tone = EXCLUDED.tone,
  is_fulfilled = EXCLUDED.is_fulfilled,
  is_cancellation = EXCLUDED.is_cancellation,
  awaiting_customer = EXCLUDED.awaiting_customer,
  customer_note = EXCLUDED.customer_note,
  commits_stock = EXCLUDED.commits_stock,
  hint = EXCLUDED.hint;

COMMIT;
