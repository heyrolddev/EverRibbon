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

INSERT INTO public.order_statuses (key, label, sort_order, is_open, is_gate, delivery_only, tone, commits_stock, hint) VALUES
  ('inquiry',       'Inquiry',       10, true,  false, false, 'ink', false,    'Someone asked. Nothing agreed yet.'),
  ('quoted',        'Quoted',        20, true,  false, false, 'ink', false,    'A price is with the customer.'),
  ('agreed',        'Agreed',        30, true,  true,  false, 'accent', false, 'Order, date and handover all settled. Waiting on the deposit.'),
  ('deposit_paid',  'Deposit paid',  40, true,  false, false, 'ok', true,     'The deposit has arrived. Work can start.'),
  ('proof_sent',    'Proof sent',    50, true,  true,  false, 'accent', true, 'With the customer. Nothing is printed until they approve.'),
  ('approved',      'Approved',      60, true,  false, false, 'ok', true,     'Approved. Build it.'),
  ('in_production', 'In production', 70, true,  false, false, 'brand', true,  'Being made now.'),
  ('ready',         'Ready',         80, true,  false, false, 'ok', true,     'Finished. Waiting for the balance or for collection.'),
  ('balance_paid',  'Balance paid',  90, true,  false, false, 'ok', true,     'Paid in full.'),
  ('delivered',     'Delivered',    100, false, false, false, 'ink', true,    'Handed over.'),
  ('cancelled',     'Cancelled',    110, false, false, false, 'bad', false,    'Did not happen.')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_open = EXCLUDED.is_open,
  is_gate = EXCLUDED.is_gate,
  delivery_only = EXCLUDED.delivery_only,
  tone = EXCLUDED.tone,
  commits_stock = EXCLUDED.commits_stock,
  hint = EXCLUDED.hint;

COMMIT;
