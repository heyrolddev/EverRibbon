--
-- 0018 — a logo URL may arrive without its size, and the app works it out.
--
-- 0015 required all three together, which is right about the end state and
-- wrong about how it is reached. Reaching it meant the owner had to find the
-- artwork's pixel dimensions and type them in — and the first answer to that
-- was "just copy the other shop's numbers", which would have declared a
-- 2.92:1 box around a square mark. The number IS the aspect ratio; a wrong
-- one is worse than none.
--
-- Every image format writes its size into its own header, so the server reads
-- it from the file rather than asking. This relaxes the constraint to allow
-- the brief state between "a URL was pasted" and "the server has looked at
-- it", which is now the normal way a logo gets set:
--
--     UPDATE shop_settings SET wordmark_dark_url = 'https://...' WHERE id = 1;
--
-- and nothing else. The size is filled in the first time a page renders.
--
-- The rule 0015 was protecting still holds where it matters: a width without
-- a height, or either without a URL, is still refused. Those are halfway
-- states nothing produces and nothing can use.
--

ALTER TABLE public.shop_settings
  DROP CONSTRAINT IF EXISTS shop_settings_wordmark_complete,
  DROP CONSTRAINT IF EXISTS shop_settings_wordmark_dark_complete;

ALTER TABLE public.shop_settings
  -- Both dimensions or neither, and neither without a URL to belong to.
  ADD CONSTRAINT shop_settings_wordmark_sane CHECK (
    (wordmark_width IS NULL) = (wordmark_height IS NULL)
    AND (wordmark_width IS NULL OR wordmark_url IS NOT NULL)
    AND (wordmark_width IS NULL OR wordmark_width > 0)
    AND (wordmark_height IS NULL OR wordmark_height > 0)
  ),
  ADD CONSTRAINT shop_settings_wordmark_dark_sane CHECK (
    (wordmark_dark_width IS NULL) = (wordmark_dark_height IS NULL)
    AND (wordmark_dark_width IS NULL OR wordmark_dark_url IS NOT NULL)
    AND (wordmark_dark_width IS NULL OR wordmark_dark_width > 0)
    AND (wordmark_dark_height IS NULL OR wordmark_dark_height > 0)
  );
