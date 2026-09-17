--
-- 0023 — a link the shop can send somebody who has no account.
--
-- The enquiry form works. Somebody asks at eleven at night, the shop prices
-- it in the morning, the order moves to "quoted" — and the person who asked
-- never finds out, because `orders` is readable by `customer_id = auth.uid()`
-- and most people who enquire have never signed in. The whole loop ended in
-- a phone call the shop had to remember to make.
--
-- So every order carries a token, and the token is a link. The shop sends it
-- however it already talks to people — Messenger, SMS, a reply on Facebook —
-- and the customer sees where their order is, what was agreed, and what it
-- costs, without an account.
--
-- THE TRADE THIS MAKES, STATED PLAINLY
--
-- The link IS the credential. Anyone holding it sees that order. That is the
-- same bargain every parcel-tracking link makes, and it is the right one
-- here: the alternative is an account barrier in front of somebody who has
-- not yet been told a price, which is where enquiries go to die.
--
-- What it does NOT do is widen `orders`. RLS is untouched. Everything below
-- goes through one SECURITY DEFINER function that returns a fixed, narrow
-- set of columns — so "what may a link show" is a list in one place rather
-- than a policy somebody later relaxes by accident.
--

--
-- 32 hex characters: 122 bits of randomness from the same source the ids use.
-- Long enough that guessing is not a threat model, short enough to paste into
-- a Messenger reply without it wrapping.
--
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS track_token text
    DEFAULT replace(gen_random_uuid()::text, '-', '');

-- Every order that already exists gets one too. An order taken last month is
-- exactly the one somebody rings about.
UPDATE public.orders
   SET track_token = replace(gen_random_uuid()::text, '-', '')
 WHERE track_token IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN track_token SET NOT NULL;

-- Unique, and the index is what makes the lookup a single row rather than a
-- scan of every order the shop has ever taken.
CREATE UNIQUE INDEX IF NOT EXISTS orders_track_token_idx
  ON public.orders (track_token);

--
-- What a link may show.
--
-- Deliberately built by hand rather than as `select *`. Everything this shop
-- would not read out over the phone is absent: what the job cost to make,
-- the margin on it, the GCash reference, the path to the payment screenshot,
-- who cancelled it. Adding a column to `orders` must never quietly add it
-- here.
--
CREATE OR REPLACE FUNCTION public.order_by_token(p_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select jsonb_build_object(
    'ticket',          o.ticket,
    'created_at',      o.created_at,
    'status',          o.status,
    'fulfillment',     o.fulfillment,
    'scheduled_for',   o.scheduled_for,
    'contact_name',    o.contact_name,
    'notes',           o.notes,
    'revenue',         o.revenue,
    'delivery_fee',    o.delivery_fee,
    'rush_fee',        o.rush_fee,
    'quoted_at',       o.quoted_at,
    'quote_valid_until', o.quote_valid_until,
    'payment_status',  o.payment_status,
    'payment_plan',    o.payment_plan,
    'downpayment_amount', o.downpayment_amount,
    'cancelled_reason', o.cancelled_reason,
    -- Whether it already belongs to an account. What decides if the page
    -- offers "this is mine" or simply shows the order.
    'claimed',         (o.customer_id is not null),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'qty',   l.qty,
               'name',  coalesce(p.name, l.label, 'Item'),
               'price', l.price_at_sale,
               'spec',  l.spec
             ) order by l.id)
      from order_lines l
      left join products p on p.id = l.product_id
      where l.order_id = o.id
    ), '[]'::jsonb),
    -- The current proof only, and without who sent it. A customer needs to
    -- see the photograph and whether it is waiting on them; the rest is the
    -- shop's own record.
    'proof', (
      select jsonb_build_object(
               'version',   pr.version,
               'image_url', pr.image_url,
               'note',      pr.note,
               'sent_at',   pr.sent_at,
               'decision',  pr.decision,
               'reply',     pr.reply
             )
      from order_proofs pr
      where pr.order_id = o.id
      order by pr.version desc
      limit 1
    )
  )
  from orders o
  where o.track_token = p_token
    -- A token of the wrong shape is not a lookup worth doing, and an empty
    -- string must never match a row.
    and length(coalesce(p_token, '')) >= 24;
$$;

REVOKE ALL ON FUNCTION public.order_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_by_token(text) TO anon, authenticated;

--
-- Taking ownership of an order you were sent a link to.
--
-- Without this the link is a dead end at exactly the moment it matters: a
-- proof cannot be approved and a payment cannot be submitted by somebody with
-- no account, and both of those already work perfectly for somebody with one.
-- Signing in and claiming is the shortest path from "here is your price" to
-- "yes, make it".
--
-- Only an order nobody owns, and only by somebody signed in. An order that
-- already belongs to an account cannot be taken from it by anyone holding an
-- old link — which is the failure that would actually matter.
--
CREATE OR REPLACE FUNCTION public.claim_order(p_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_id text;
begin
  if auth.uid() is null or length(coalesce(p_token, '')) < 24 then
    return false;
  end if;

  update orders
     set customer_id = auth.uid()
   where track_token = p_token
     and customer_id is null
  returning id into v_id;

  return v_id is not null;
end;
$$;

REVOKE ALL ON FUNCTION public.claim_order(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_order(text) TO authenticated;

COMMENT ON COLUMN public.orders.track_token IS
  'The handle in a /track/… link. Whoever holds it may read this one order through order_by_token, and claim it if nobody owns it yet.';
