--
-- 0022 — "ganito po ang gusto ko".
--
-- The most common first message a made-to-order shop receives is a
-- photograph. Not a description: a picture of somebody else's bouquet, or
-- last year's sash, or a screenshot from a Facebook page. Every one of those
-- was arriving on Messenger, and the enquiry form added in the last change
-- could take everything about a job EXCEPT the one thing most people send.
--
-- So an order can carry a few reference photographs.
--
-- Paths, not URLs, and in the private bucket 0021 made. A reference is
-- usually a photograph of a person at a graduation, and it belongs no more
-- in a world-readable bucket than a payment screenshot does.
--

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reference_paths text[] DEFAULT '{}'::text[] NOT NULL;

COMMENT ON COLUMN public.orders.reference_paths IS
  'Paths inside the shop''s PRIVATE bucket — what the customer sent as an example of what they want. Served only as signed links.';

--
-- A ceiling, in the database rather than only in the form.
--
-- The enquiry form is open to anyone on the internet and writes with the
-- service-role client, which is exactly the combination where "the browser
-- only ever sends three" stops being true. Three is what somebody sending an
-- example actually sends; a row with four hundred is a script.
--
ALTER TABLE public.orders
  ADD CONSTRAINT orders_reference_paths_cap
    CHECK (coalesce(array_length(reference_paths, 1), 0) <= 6);

--
-- And nothing empty in it.
--
-- An empty string is a path to the bucket root and a NULL is a hole the
-- readers would each have to remember to skip. Written with `array_position`
-- and `array_remove` rather than the obvious `NOT EXISTS (SELECT … unnest)`,
-- because a CHECK constraint may not contain a subquery — Postgres refuses
-- it outright, which is how this was found.
--
-- It catches the empty string exactly; a path of nothing but spaces is left
-- to the application, which trims before it stores or signs anything. The
-- point of this one is the shape of the data, not its tidiness.
--
ALTER TABLE public.orders
  ADD CONSTRAINT orders_reference_paths_nonblank
    CHECK (
      array_position(reference_paths, '') IS NULL
      AND cardinality(reference_paths)
          = cardinality(array_remove(reference_paths, NULL))
    );
