--
-- Which step means the materials are spoken for.
--
-- Taking stock off the shelf was keyed to four status names written into the
-- code: confirmed, preparing, ready, completed. That is correct for a counter
-- and silently wrong for anything else -- a made-to-order shop whose steps are
-- agreed, deposit_paid, in_production, delivered shares exactly one of those
-- names, so its materials would have stayed on the shelf through the entire
-- build and come off at "ready", after they were already used.
--
-- Nothing would have failed. Stock counts would simply have been wrong, and
-- wrong in the direction that reads as "we have plenty" until a Saturday.
--
-- So the question moves to the row that answers it. A shop marks the step at
-- which its materials are committed, and the stock code asks rather than
-- assumes.
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path TO '';
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE public.order_statuses
  ADD COLUMN IF NOT EXISTS commits_stock boolean DEFAULT false NOT NULL;

-- The counter flow, as the code had it hardcoded.
UPDATE public.order_statuses
SET commits_stock = true
WHERE key IN ('confirmed', 'preparing', 'ready', 'completed');

-- The made-to-order flow, for a shop already on the seed. Stock is committed
-- once the deposit has arrived: that is the point work starts and the ribbon
-- is cut, which is also the point the deposit stops being refundable. The two
-- are the same moment on purpose.
UPDATE public.order_statuses
SET commits_stock = true
WHERE key IN ('deposit_paid', 'approved', 'in_production', 'ready', 'balance_paid', 'delivered');
