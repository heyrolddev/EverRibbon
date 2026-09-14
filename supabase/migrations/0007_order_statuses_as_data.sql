--
-- The steps an order goes through, as rows instead of a constant.
--
-- The list was a CHECK constraint and a TypeScript array, which meant a shop
-- whose work is shaped differently needed a migration and a deploy to add one
-- step. A ribbon shop that sends a proof and waits for approval has ten
-- states; a stall handing food over the counter has seven; neither is wrong.
--
-- Two of the columns carry meaning the old array could not:
--
--   is_open    the shop still owes this customer something. Drives the badge
--              counts and the "what is live" queries, which previously listed
--              five status names in four separate files.
--   is_gate    nothing proceeds past this without a person acting. A deposit
--              that has not arrived and a proof nobody approved are both gates,
--              and production must not start at either.
--
-- orders.status becomes a foreign key rather than a CHECK, so a status still
-- in use cannot be deleted, and renaming one carries through to every order.
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path TO '';
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

CREATE TABLE public.order_statuses (
    key text NOT NULL,
    label text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    is_gate boolean DEFAULT false NOT NULL,
    -- "On the way" is nonsense for a pick-up, so the step is hidden rather
    -- than offered as something staff can never legitimately use.
    delivery_only boolean DEFAULT false NOT NULL,
    -- Which ramp the chip takes. A name, never a colour: see globals.css.
    tone text DEFAULT 'ink' NOT NULL,
    hint text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_statuses_pkey PRIMARY KEY (key),
    CONSTRAINT order_statuses_key_shape CHECK (key ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT order_statuses_tone_check CHECK (tone = ANY (ARRAY['brand'::text, 'accent'::text, 'ink'::text, 'ok'::text, 'warn'::text, 'bad'::text]))
);

ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;

-- Customers see the steps so a tracker can name them; only an owner edits.
CREATE POLICY "public_read_order_statuses" ON public.order_statuses FOR SELECT USING (true);
CREATE POLICY "owner_manage_order_statuses" ON public.order_statuses USING (public.is_owner()) WITH CHECK (public.is_owner());

--
-- The default flow: a counter that hands over immediately.
--
-- Seeded rather than left empty because an empty list means no order can be
-- given any status at all, and a shop that has not touched this screen should
-- still work. A made-to-order shop replaces these — see
-- supabase/seeds/made-to-order-statuses.sql.
--
INSERT INTO public.order_statuses (key, label, sort_order, is_open, is_gate, delivery_only, tone, hint) VALUES
  ('pending',          'Pending',    10, true,  true,  false, 'accent', 'New in. Nobody has accepted these yet.'),
  ('confirmed',        'Confirmed',  20, true,  false, false, 'warn',   'Accepted, not started.'),
  ('preparing',        'Preparing',  30, true,  false, false, 'brand',  'Being made now.'),
  ('ready',            'Ready',      40, true,  false, false, 'ok',     'Waiting for the customer.'),
  ('out_for_delivery', 'On the way', 50, true,  false, true,  'ink',    'Left the shop.'),
  ('completed',        'Completed',  60, false, false, false, 'ink',    'Done and handed over.'),
  ('cancelled',        'Cancelled',  70, false, false, false, 'bad',    'Did not happen.');

-- The constraint the table replaces. Dropped only now, so the statuses it
-- allowed exist as rows before anything can reference them.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_fkey FOREIGN KEY (status)
  REFERENCES public.order_statuses(key) ON UPDATE CASCADE;

CREATE INDEX idx_orders_status_open ON public.orders (status) WHERE status IS NOT NULL;
