--
-- 0021 — a customer's payment screenshot stops being a public file.
--
-- A GCash receipt carries a person's full name, their phone number, the
-- amount and a reference number. Every one uploaded so far has gone into the
-- same public bucket as the product photographs, under `receipts/`, and been
-- stored as a public URL. Anyone who can read from that bucket can read them
-- — and on a public bucket that is everyone, including whoever can list it.
--
-- Nothing failed. That is what makes it worth a migration: a public bucket
-- serves a private file exactly as cheerfully as it serves a product photo.
--
-- From here a receipt lives in a second, private bucket and the row keeps its
-- PATH rather than a URL. Nothing serves it without a short-lived signed link
-- minted for somebody the server has checked.
--

-- Where the file is, inside the private bucket. Not a URL: a private object
-- does not have one, and that is the whole point of the change.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_receipt_path text;

COMMENT ON COLUMN public.orders.payment_receipt_path IS
  'Path inside the shop''s PRIVATE bucket. Served only as a signed link, minted per viewer. New uploads use this.';

--
-- The old column is not dropped and not backfilled.
--
-- Dropping it would take the receipts already collected with it, and those
-- are the evidence behind payments the shop has already confirmed. Moving the
-- files is a job for a person with the bucket in front of them, not for a
-- migration that would leave half of them moved if it failed in the middle.
-- So both are read, the new one first, and the old one is marked for what it
-- now is.
--
COMMENT ON COLUMN public.orders.payment_receipt_url IS
  'LEGACY. A public URL from before receipts were private. Still read so old orders keep their evidence; never written to again.';

-- Staff read orders through this view, so it has to carry the new column or
-- the payments screen shows every receipt as missing.
CREATE OR REPLACE VIEW public.orders_for_staff WITH (security_invoker='true') AS
 SELECT id,
    created_at,
    date,
    customer_id,
    status,
    fulfillment,
    scheduled_for,
    contact_name,
    contact_phone,
    notes,
    tag,
    logged_by,
    shift_id,
    delivery_address,
    delivery_lat,
    delivery_lng,
    delivery_distance_km,
    delivery_fee,
    revenue,
    eta_minutes,
    eta_set_at,
    cancelled_reason,
    payment_status,
    payment_method,
    payment_plan,
    payment_reference,
    payment_receipt_url,
    downpayment_amount,
    downpayment_confirmed_at,
    paid_at,
    payment_receipt_path
   FROM public.orders;

--
-- The customer's own "I have paid" submission, taking a path instead.
--
-- Dropped and recreated rather than overloaded. A second three-argument
-- version differing only in a parameter name is a call that resolves to
-- whichever Postgres picks, and the two would write to different columns —
-- so the failure would be a receipt that silently lands in the public
-- column again. Dropping means an out-of-date caller fails loudly instead,
-- which for this function is the outcome to want.
--
DROP FUNCTION IF EXISTS public.submit_payment_reference(text, text, text);

CREATE FUNCTION public.submit_payment_reference(
  p_order_id text,
  p_reference text,
  p_receipt_path text DEFAULT NULL::text
) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_owner uuid;
  v_status text;
  v_payment_status text;
  v_existing_receipt text;
  v_reference text := nullif(btrim(p_reference), '');
begin
  select customer_id, status, payment_status,
         coalesce(payment_receipt_path, payment_receipt_url)
    into v_owner, v_status, v_payment_status, v_existing_receipt
  from orders where id = p_order_id;

  if v_owner is null or v_owner <> auth.uid() then
    return false;                            -- not yours (or a walk-in order)
  end if;
  if v_status = 'cancelled' then
    return false;                            -- nothing left to pay for
  end if;
  if v_payment_status in ('partial', 'paid') then
    return false;                            -- already confirmed by the shop
  end if;

  -- At least one form of proof, counting a screenshot already on file —
  -- whichever of the two columns it is on.
  if v_reference is null
     and p_receipt_path is null
     and v_existing_receipt is null then
    return false;
  end if;

  update orders
     set payment_reference    = coalesce(v_reference, payment_reference),
         payment_receipt_path = coalesce(p_receipt_path, payment_receipt_path),
         payment_status       = 'submitted'
   where id = p_order_id;

  return true;
end;
$$;

REVOKE ALL ON FUNCTION public.submit_payment_reference(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payment_reference(text, text, text) TO authenticated;
