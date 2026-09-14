--
-- The rows the application assumes exist.
--
-- Every settings table here is a singleton: one row, id 1, holding the shop's
-- own numbers. The code reads them with .single(), so a missing row is not an
-- empty form -- it is an error on the screen that shows it, and the shop
-- cannot open.
--
-- These were lost on the way in and it is worth saying how, because the same
-- trap is waiting for anyone who regenerates this baseline. It was produced by
-- dumping a working database, and `pg_dump --schema-only` does exactly what it
-- says: tables, constraints, policies, functions -- and not one row. The schema
-- loaded perfectly and the settings tables were empty, which surfaced as a
-- capacity ceiling that read as blank rather than as anything resembling a
-- missing row.
--
-- Structural rows only. Categories, answers and announcements are a shop's own
-- content and belong to whoever sets the shop up, not to the template.
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path TO '';
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

INSERT INTO public.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.shop_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.delivery_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.chat_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- One row per weekday, so the hours editor has something to edit. A shop that
-- has not set its hours is closed, which is the safe direction: better a
-- customer told "closed" than an order taken for a day nobody is working.
INSERT INTO public.shop_hours (weekday) VALUES (0),(1),(2),(3),(4),(5),(6)
ON CONFLICT (weekday) DO NOTHING;
