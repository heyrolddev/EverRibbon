--
-- EverRibbon's catalogue, from the shop's own price list.
--
-- A seed rather than a migration: this is one shop's data. The next business
-- installing this template writes its own, and neither is more correct.
--
--     psql "$DATABASE_URL" -f supabase/seeds/everribbon-catalogue.sql
--
-- Safe to re-run. Every row is keyed by a stable id and upserts, so running
-- it twice updates prices rather than creating a second catalogue — which
-- also makes it the way to push a price change if the owner would rather edit
-- a file than six screens.
--
-- Requires migration 0016 (price ladders).
--
-- Two things are deliberately NOT here:
--
--   assembly_minutes on the petite bouquets, because nobody has timed one.
--   Zero reads as "not costed" throughout this system and the quote desk
--   says so out loud; a number invented here would read as measured.
--
--   Photographs. `image_url` stays null until the shop has shot the product,
--   and the menu draws a tinted panel with the product's name rather than a
--   broken frame.
--

BEGIN;

-- ------------------------------------------------------------- categories --

INSERT INTO public.catalog_categories (name, colour, sort_order) VALUES
  ('Ribbon Prints',   'brand',  10),
  ('Sash Printing',   'accent', 20),
  ('Graduation',      'ok',     30),
  ('EverCraft',       'warn',   40),
  ('Print Services',  'ink',    50),
  ('Add-ons',         'paper',  60)
ON CONFLICT (name) DO UPDATE SET
  colour = EXCLUDED.colour,
  sort_order = EXCLUDED.sort_order;

-- --------------------------------------------------------------- products --

INSERT INTO public.products
  (id, name, price, kind, categories, description, unit, allow_fractional,
   assembly_minutes, is_public, is_available)
VALUES
  -- Cut-edge ribbon, sold by the roll. Roughly 50 yards a roll; the price
  -- drops at five rolls and again at ten, which is what 0016 exists for.
  ('rib-basic-half',    'Cut-edge ribbon 1/2" — basic ink',    500, 'single', '{Ribbon Prints}',
   'Approx. 50 yards per roll. Basic ink colours.', 'roll', false, 0, true, true),
  ('rib-basic-three',   'Cut-edge ribbon 3/4" — basic ink',    600, 'single', '{Ribbon Prints}',
   'Approx. 50 yards per roll. Basic ink colours.', 'roll', false, 0, true, true),
  ('rib-basic-one',     'Cut-edge ribbon 1" — basic ink',      700, 'single', '{Ribbon Prints}',
   'Approx. 50 yards per roll. Basic ink colours.', 'roll', false, 0, true, true),
  ('rib-special-half',  'Cut-edge ribbon 1/2" — special ink',  550, 'single', '{Ribbon Prints}',
   'Approx. 50 yards per roll. Metallic and specialty inks.', 'roll', false, 0, true, true),
  ('rib-special-three', 'Cut-edge ribbon 3/4" — special ink',  650, 'single', '{Ribbon Prints}',
   'Approx. 50 yards per roll. Metallic and specialty inks.', 'roll', false, 0, true, true),
  ('rib-special-one',   'Cut-edge ribbon 1" — special ink',    750, 'single', '{Ribbon Prints}',
   'Approx. 50 yards per roll. Metallic and specialty inks.', 'roll', false, 0, true, true),

  -- Sashes, by the piece.
  ('sash-1yd-basic',    'Graduate sash 80mm, 1 yard — basic ink',    130, 'single', '{Sash Printing}',
   'For sablay, weddings, birthdays, pageants and event guests.', 'piece', false, 0, true, true),
  ('sash-1yd-special',  'Graduate sash 80mm, 1 yard — special ink',  150, 'single', '{Sash Printing}',
   'For sablay, weddings, birthdays, pageants and event guests.', 'piece', false, 0, true, true),
  ('sash-2yd-basic',    'Wrap-around sash 80mm, 2 yards — basic ink',   180, 'single', '{Sash Printing}',
   'Two yards, worn wrapped.', 'piece', false, 0, true, true),
  ('sash-2yd-special',  'Wrap-around sash 80mm, 2 yards — special ink', 200, 'single', '{Sash Printing}',
   'Two yards, worn wrapped.', 'piece', false, 0, true, true),

  -- Graduation season.
  ('grad-print',        'Graduation ribbon — print only',           7, 'single', '{Graduation}',
   NULL, 'piece', false, 0, true, true),
  ('grad-tassel',       'Graduation ribbon — with tassel',         11, 'single', '{Graduation}',
   NULL, 'piece', false, 0, true, true),
  ('grad-logo',         'Graduation ribbon — with logo head',      13, 'single', '{Graduation}',
   NULL, 'piece', false, 0, true, true),
  ('grad-logo-tassel',  'Graduation ribbon — logo head & tassel',  16, 'single', '{Graduation}',
   NULL, 'piece', false, 0, true, true),
  ('grad-lei',          'Guest lei, 4ft',                         200, 'single', '{Graduation}',
   'Four feet of lace with a customisable centrepiece.', 'piece', false, 0, true, true),

  -- EverCraft bouquets. The Deluxe times come from a measured batch: 540
  -- minutes of work yielded 100 flowers, so 5.4 minutes a flower. The Petite
  -- flowers are smaller and nobody has timed one, so they stay at zero, which
  -- reads as "not costed" rather than as "free".
  ('craft-deluxe-1',    'Deluxe bouquet — single stem',    149, 'single', '{EverCraft}',
   '4cm petals, one flower.', 'piece', false, 5.4,  true, true),
  ('craft-deluxe-3',    'Deluxe bouquet — 3 stems',        299, 'single', '{EverCraft}',
   '4cm petals.', 'piece', false, 16.2, true, true),
  ('craft-deluxe-7',    'Deluxe bouquet — 7 stems',        699, 'single', '{EverCraft}',
   '4cm petals.', 'piece', false, 37.8, true, true),
  ('craft-deluxe-12',   'Deluxe bouquet — 12 stems',      1099, 'single', '{EverCraft}',
   '4cm petals.', 'piece', false, 64.8, true, true),
  ('craft-petite-3',    'Petite bouquet — 3 stems',        199, 'single', '{EverCraft}',
   '2cm petals.', 'piece', false, 0, true, true),
  ('craft-petite-7',    'Petite bouquet — 7 stems',        379, 'single', '{EverCraft}',
   '2cm petals.', 'piece', false, 0, true, true),
  ('craft-petite-12',   'Petite bouquet — 12 stems',       649, 'single', '{EverCraft}',
   '2cm petals.', 'piece', false, 0, true, true),

  -- Add-ons. Public, because a customer choosing a bouquet wants to know what
  -- the glitter costs before they ask.
  ('addon-glitter',     'Glitter finish',                   10, 'single', '{Add-ons}',
   'Per flower.', 'flower', false, 0, true, true),
  ('addon-butterfly',   'Butterfly accessory',              15, 'single', '{Add-ons}',
   NULL, 'piece', false, 0, true, true),
  ('addon-fairy',       'Fairy lights',                     50, 'single', '{Add-ons}',
   NULL, 'piece', false, 0, true, true),
  ('addon-bag-s',       'Premium packaging bag — small',    10, 'single', '{Add-ons}',
   NULL, 'piece', false, 0, true, true),
  ('addon-bag-m',       'Premium packaging bag — medium',   20, 'single', '{Add-ons}',
   NULL, 'piece', false, 0, true, true),
  ('addon-bag-l',       'Premium packaging bag — L to XL',  30, 'single', '{Add-ons}',
   NULL, 'piece', false, 0, true, true),
  ('addon-double-edge', 'Double-edge ribbon upgrade',       50, 'single', '{Add-ons}',
   'Per roll, on either basic or special ink.', 'roll', false, 0, true, true),

  -- Print services.
  ('print-cards',       'Business, calling, loyalty & thank-you cards', 4, 'single', '{Print Services}',
   '300gsm. Free card box and a simple design included.', 'piece', false, 0, true, true),
  ('print-inv-300',     'Card invitation — 300gsm thick',  160, 'single', '{Print Services}',
   'Weddings, events, christenings, birthdays.', 'piece', false, 0, true, true),
  ('print-inv-scented', 'Card invitation — scented paper', 170, 'single', '{Print Services}',
   'Weddings, events, christenings, birthdays.', 'piece', false, 0, true, true),
  ('print-inv-texture', 'Card invitation — textured paper',180, 'single', '{Print Services}',
   'Weddings, events, christenings, birthdays.', 'piece', false, 0, true, true),
  -- Priced per job, so it carries no price and says why on the page.
  ('print-giveaways',   'Personalised giveaways',            0, 'single', '{Print Services}',
   'Priced per job, from the materials you choose. Ask for a quote.', 'piece', false, 0, true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  categories = EXCLUDED.categories,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  assembly_minutes = EXCLUDED.assembly_minutes,
  is_public = EXCLUDED.is_public;

-- ----------------------------------------------------------- the ladders --

-- Cleared first so a rung removed from the price list actually disappears
-- rather than lingering as the cheapest row nobody meant to keep.
DELETE FROM public.product_price_breaks
WHERE product_id IN (
  'rib-basic-half','rib-basic-three','rib-basic-one',
  'rib-special-half','rib-special-three','rib-special-one',
  'print-cards'
);

INSERT INTO public.product_price_breaks (product_id, min_qty, unit_price) VALUES
  -- Basic ink: 1-4 / 5-9 / 10+
  ('rib-basic-half',     5, 450), ('rib-basic-half',    10, 400),
  ('rib-basic-three',    5, 550), ('rib-basic-three',   10, 500),
  ('rib-basic-one',      5, 650), ('rib-basic-one',     10, 600),
  -- Special ink: fifty pesos dearer at every rung.
  ('rib-special-half',   5, 500), ('rib-special-half',  10, 450),
  ('rib-special-three',  5, 600), ('rib-special-three', 10, 550),
  ('rib-special-one',    5, 700), ('rib-special-one',   10, 650),
  -- ₱380 per hundred is ₱3.80 each.
  ('print-cards',      100, 3.80);

COMMIT;
