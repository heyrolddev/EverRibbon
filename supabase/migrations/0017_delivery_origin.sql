--
-- 0017 — a shop that has not said where it delivers from does not say.
--
-- The third copy of the same coordinates. One shop's real pin was written
-- into this template in three places: the brand config, the TypeScript
-- defaults, and here — as a column DEFAULT, with NOT NULL beside it.
--
--     shop_lat double precision DEFAULT 14.9508 NOT NULL
--
-- So every fresh install inherits a point in Apalit, Pampanga as the origin
-- every delivery fee is measured from, and cannot clear it even on purpose.
-- The app was fixed to refuse a quote without an origin; the database made
-- that state unreachable, which would have left the fix looking like it
-- worked while nothing could ever exercise it.
--
-- Nothing fails when the origin is wrong. The fee is simply computed from
-- somewhere else — fifteen kilometres away, in this case — and it is
-- plausible enough that nobody queries it. That is the whole reason a
-- missing value has to be visible and a guessed one is not acceptable.
--

ALTER TABLE public.delivery_settings
  ALTER COLUMN shop_lat DROP DEFAULT,
  ALTER COLUMN shop_lng DROP DEFAULT,
  ALTER COLUMN shop_lat DROP NOT NULL,
  ALTER COLUMN shop_lng DROP NOT NULL;

ALTER TABLE public.delivery_settings
  -- Both or neither. Half a coordinate is a point on the equator or on the
  -- prime meridian, which is a real place and not this one.
  ADD CONSTRAINT delivery_settings_origin_complete CHECK (
    (shop_lat IS NULL) = (shop_lng IS NULL)
  );

--
-- Clear the inherited pin, and only the inherited pin.
--
-- Matched against the exact scaffold default rather than blanked outright: a
-- shop that has dropped its own pin keeps it, and the chance of a real shop
-- landing on these two numbers to four decimal places is nil. A shop that
-- genuinely is at this spot re-drops it in one tap and is then holding a
-- value it chose rather than one it inherited.
--
UPDATE public.delivery_settings
SET shop_lat = NULL, shop_lng = NULL
WHERE shop_lat = 14.9508 AND shop_lng = 120.7581;
