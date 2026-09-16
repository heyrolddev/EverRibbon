--
-- 0015 — the shop's artwork, owned by the shop.
--
-- `brand.wordmark` in the config was the right shape and the wrong home. A
-- logo is not a deploy-time fact: it arrives after the site is up, it gets
-- redrawn, and the person who has it is the owner rather than whoever has the
-- repository. Asking a developer to commit a PNG is how a shop runs for three
-- months with its name set in a fallback face.
--
-- So it moves to a row the owner can change, and the config keeps what it is
-- good at: the value a brand-new install starts with, before anybody has
-- uploaded anything.
--
-- The dimensions are stored with it because the browser knows them at upload
-- and nothing else does. Without them the page cannot reserve the space, and
-- the header jumps as the mark loads — on every first visit, on every page.
--

ALTER TABLE public.shop_settings
  ADD COLUMN IF NOT EXISTS wordmark_url text,
  -- The artwork's own pixels, not the size it is drawn at.
  ADD COLUMN IF NOT EXISTS wordmark_width integer,
  ADD COLUMN IF NOT EXISTS wordmark_height integer,
  --
  -- A second mark, for the dark half of the site.
  --
  -- A gold mark on black is the whole point of a gold brand, and the same
  -- file on a cream header measures 2.28 against the paper — which is not a
  -- style opinion, it is below the 4.5 a person needs to read it. One file
  -- cannot serve both grounds, and the answer is not to pick a compromise
  -- colour that is wrong in both places. Null means "use the light one
  -- everywhere", which is correct for a mark that is legible on either.
  ADD COLUMN IF NOT EXISTS wordmark_dark_url text,
  ADD COLUMN IF NOT EXISTS wordmark_dark_width integer,
  ADD COLUMN IF NOT EXISTS wordmark_dark_height integer;

ALTER TABLE public.shop_settings
  -- Half a wordmark is worse than none: a URL with no dimensions renders at
  -- whatever the browser guesses and moves the header when it loads.
  ADD CONSTRAINT shop_settings_wordmark_complete CHECK (
    wordmark_url IS NULL
      OR (wordmark_width > 0 AND wordmark_height > 0)
  ),
  ADD CONSTRAINT shop_settings_wordmark_dark_complete CHECK (
    wordmark_dark_url IS NULL
      OR (wordmark_dark_width > 0 AND wordmark_dark_height > 0)
  );
