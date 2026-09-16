--
-- The handful of facts only the shop owner knows.
--
-- Everything else in this system either ships in the config or is entered on
-- a screen. These four are the ones that need a person who has the logo file,
-- knows where the shop actually is, and can say which phone number is the one
-- that rings — and they are needed BEFORE there is a site to enter them on,
-- which is why they are here rather than only in HQ.
--
--     Supabase dashboard → SQL Editor → paste → Run
--
-- Fill in the marked values first. Every block is safe to run on its own and
-- safe to run twice; skip any you are not ready for and come back.
--
-- Once the site is running, all of this is editable on a screen instead:
-- HQ → Logo, HQ → Delivery, HQ → Hours.
--

-- ==========================================================================
-- 1. THE LOGO
-- ==========================================================================
--
-- Upload the files to Storage first (bucket `everribbon`), then copy each
-- public URL from the file's "Get URL" menu. That is all — no pixel sizes.
-- The server reads the size out of the file's own header the first time a
-- page renders, and stores it.
--
-- (It used to ask for width and height. The first answer back was "just copy
-- the other shop's numbers", which would have declared a 2.92:1 box around a
-- square mark. The number IS the aspect ratio, so a wrong one is worse than
-- none — and the file knows it anyway.)
--
-- Two slots, because one file cannot serve both grounds. Metallic gold
-- measures about 2.3 to 1 against this site's cream — below the 4.5 a person
-- needs to read comfortably — so the mark that is the whole point of a gold
-- brand on black is genuinely hard to read on a light header.
--
--   wordmark_url        the DARK version, for the light header and for print
--   wordmark_dark_url   the GOLD version, for the footer, the hero, the
--                       loading screen
--
-- Fill in only the one you have. The dark slot falls back to the light one,
-- and with neither the shop's name is set in its own display face instead —
-- which is a supported state, not a broken one.

UPDATE public.shop_settings SET
  -- ↓ the GOLD mark, for dark backgrounds
  wordmark_dark_url =
    'https://blvfphsvbvtghtjcgxda.supabase.co/storage/v1/object/public/everribbon/EverRibbon_Final-no_bg.png',

  -- ↓ the DARK mark, for light backgrounds — the header and anything printed.
  --   Leave it NULL until there is one: the shop's name is set in Bodoni in
  --   the meantime, which is legible, and a gold mark on cream is not.
  wordmark_url =
    'https://blvfphsvbvtghtjcgxda.supabase.co/storage/v1/object/public/everribbon/3-removebg-preview.png',

  -- Cleared so the server re-reads both files' headers on the next render.
  -- A size belongs to the file it was measured from; keeping the old numbers
  -- against a new URL is how a mark ends up drawn at another mark's ratio.
  wordmark_width = NULL, wordmark_height = NULL,
  wordmark_dark_width = NULL, wordmark_dark_height = NULL
WHERE id = 1;


-- ==========================================================================
-- 2. WHERE DELIVERY IS MEASURED FROM
-- ==========================================================================
--
-- Until this is set, delivery is offered to nobody — deliberately. The
-- alternative is measuring from a guess, which does not fail: it just quotes
-- the wrong fee, every time, with total confidence. That is exactly what this
-- template did before, from a pin that belonged to a different shop in a
-- different province.
--
-- To get the numbers: open Google Maps, find the shop, right-click the exact
-- spot. The first line of the menu is the coordinates — click it to copy.
-- Latitude first, longitude second.

UPDATE public.delivery_settings SET
  shop_lat = NULL,   -- e.g. 14.9182
  shop_lng = NULL    -- e.g. 120.7654
WHERE id = 1;


-- ==========================================================================
-- 3. WHEN THE SHOP IS OPEN
-- ==========================================================================
--
-- Seven rows, one per weekday, 0 = Sunday. Times are 24-hour.
--
-- The homepage folds runs of identical days together, so setting Monday to
-- Saturday the same reads as "Mon – Sat" rather than as six rows.
--
-- The example below is 9am–6pm Monday to Saturday, closed Sunday. Change the
-- times, or set is_open = false for any day the shop does not work.

UPDATE public.shop_hours SET is_open = true,  opens = '09:00', closes = '18:00' WHERE weekday BETWEEN 1 AND 6;
UPDATE public.shop_hours SET is_open = false                                     WHERE weekday = 0;


-- ==========================================================================
-- 4. CHECK IT LANDED
-- ==========================================================================

SELECT
  CASE WHEN wordmark_url IS NULL AND wordmark_dark_url IS NULL
       THEN 'no logo yet — the shop name is set in its own face'
       ELSE 'logo set' END                                      AS logo,
  (SELECT CASE WHEN shop_lat IS NULL
               THEN 'NO PIN — delivery is offered to nobody'
               ELSE 'pin set' END FROM public.delivery_settings WHERE id = 1) AS delivery,
  (SELECT count(*) FROM public.shop_hours WHERE is_open)        AS open_days,
  (SELECT count(*) FROM public.products WHERE is_public)        AS products_on_the_site
FROM public.shop_settings WHERE id = 1;
