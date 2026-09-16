--
-- The tables a browser subscribes to for live updates.
--
-- Four screens in this system update without a refresh: the order board, the
-- customer's own tracker, the chat inbox, and who is on shift. All four work
-- by subscribing to Postgres changes, and a table only publishes those changes
-- if it belongs to the `supabase_realtime` publication.
--
-- This is a repair. The baseline was produced by dumping a working database
-- with `pg_dump --schema-only`, which carries tables, constraints, policies and
-- functions -- and not publication membership. The schema loaded perfectly and
-- every one of those screens would have simply stopped updating, with nothing
-- in any log to say why: no error, no failed request, just a board that never
-- moves until someone reloads it.
--
-- It is the second thing the schema-only dump quietly dropped, after the
-- singleton settings rows in 0009. Both were found by asking what the
-- application needs rather than by reading the dump.
--
-- Written to be safe to run twice: adding a table that is already published
-- raises, and a migration nobody dares re-run is a migration nobody trusts.
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

DO $$
DECLARE
  t text;
BEGIN
  -- The hosting platform creates this publication. Outside it -- a local
  -- Postgres, a test container -- nothing has, so there is nothing to join.
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'no supabase_realtime publication here; skipping realtime setup';
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY['orders', 'chat_messages', 'chat_threads', 'staff_shifts'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

--
-- Realtime sends a row's OLD values on update and delete only when the table
-- says which columns identify it. Without this the browser gets a change
-- notification it cannot match to anything it is showing, so a board updates
-- by refetching everything instead of by patching one row.
--
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_threads REPLICA IDENTITY FULL;
ALTER TABLE public.staff_shifts REPLICA IDENTITY FULL;
