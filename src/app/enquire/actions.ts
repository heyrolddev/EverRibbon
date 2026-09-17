"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isConfigured } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getOrderStatuses } from "@/lib/order-statuses-server";
import { getSpecQuestions } from "@/lib/spec-server";
import { answersFrom, missingRequired, questionsFor, specJson } from "@/lib/spec";
import { notifyEnquiry } from "@/lib/notify";
import { shopToday } from "@/lib/format";

/**
 * Somebody asking for something that does not exist yet.
 *
 * The made-to-order steps have begun with "Inquiry — someone asked, nothing
 * agreed yet" since the seed was written, and there has been no way to
 * produce one. Every enquiry arrived by phone or Messenger and was retyped,
 * or lost — and the ones that arrive at eleven at night, which is when people
 * plan a graduation, were mostly lost.
 *
 * So it is an order in the shop's first step, with the answers to the shop's
 * own questions on its line. Not a separate enquiries table: the whole point
 * of the status list is that an enquiry and a delivered order are the same
 * record at different moments, and nothing has to be copied across when the
 * customer says yes — copying is where the thing they asked for and the thing
 * being made start to differ.
 */

export type EnquiryDraft = {
  name: string;
  phone: string;
  /** What they want, in their own words. */
  wants: string;
  qty: number;
  /** ISO date, or empty while they are still deciding. */
  needBy: string;
  /** What kind of work, which decides which questions were asked. */
  categories: string[];
  /** Answers as typed, keyed by question. */
  spec: Record<string, string>;
};

export type EnquiryResult =
  | { ok: true; ticket: number | null }
  | { ok: false; error: string };

const MAX_WANTS = 1200;

/**
 * Keyed by address rather than by anything the form supplies.
 *
 * Six an hour is far above what a person planning one graduation reaches and
 * far below what makes a shop's order board unusable. A household or a café
 * shares a bucket, which is why it is not set at the edge.
 */
async function caller(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return `enquire:${fwd?.split(",")[0]?.trim() || "unknown"}`;
}

/** Enough digits to be a number somebody could ring back. */
const phoneDigits = (v: string) => v.replace(/\D/g, "").length;

export async function sendEnquiry(draft: EnquiryDraft): Promise<EnquiryResult> {
  if (!isConfigured()) {
    return { ok: false, error: "This site isn't connected to its database yet." };
  }
  if (!rateLimit(await caller(), 6, 60 * 60_000).allowed) {
    return {
      ok: false,
      error: "That's a few enquiries in a row — give it a moment, or ring the shop.",
    };
  }

  const name = draft.name.trim();
  const phone = draft.phone.trim();
  const wants = draft.wants.trim();

  if (name.length < 2) return { ok: false, error: "What should we call you?" };
  if (phoneDigits(phone) < 7) {
    return { ok: false, error: "We need a number we can reach you on." };
  }
  if (wants.length < 4) {
    return { ok: false, error: "Tell us what you'd like, even roughly." };
  }
  if (wants.length > MAX_WANTS) {
    return { ok: false, error: `Keep it under ${MAX_WANTS} characters.` };
  }

  const qty = Number.isFinite(draft.qty) ? Math.floor(draft.qty) : 1;
  if (qty < 1 || qty > 999) return { ok: false, error: "How many, between 1 and 999?" };

  const today = shopToday();
  // A date already gone is a typo, not a deadline. Refused here rather than
  // silently accepted, because the capacity calendar would book it into a day
  // that has been and gone.
  if (draft.needBy && draft.needBy < today) {
    return { ok: false, error: "That date has passed — pick one still to come." };
  }

  const [statuses, questions] = await Promise.all([getOrderStatuses(), getSpecQuestions()]);

  /*
   * The shop's own first step, asked of the data.
   *
   * Never the string "inquiry". A shop that calls its first step something
   * else gets its enquiries in the right place; a shop with no open step at
   * all is told, rather than having an order written into a status its own
   * foreign key will refuse.
   */
  const first = [...statuses]
    .filter((s) => s.isOpen && !s.isCancellation)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  if (!first) {
    return { ok: false, error: "The shop isn't taking enquiries through the site yet." };
  }

  const asked = questionsFor(questions, draft.categories);
  const gaps = missingRequired(asked, draft.spec);
  if (gaps.length > 0) {
    return { ok: false, error: `Still needed: ${gaps.map((g) => g.label).join(", ")}.` };
  }

  /*
   * Written with the service-role client, like the chat threads.
   *
   * Somebody enquiring has usually never signed in, so there is no session to
   * write under — and giving the public an INSERT policy on `orders` would be
   * a door onto the table the whole shop runs from. The limiter above and the
   * checks in this function are what stand in its place.
   *
   * Where they ARE signed in, the order is theirs: it shows up on their own
   * page and they can answer the proof on it later.
   */
  const viewer = await (await createClient()).auth.getUser();
  const customerId = viewer.data.user?.id ?? null;

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      date: today,
      status: first.key,
      // Not known yet, and asking at this point costs the enquiry. It is
      // settled when the quote is agreed.
      fulfillment: "pickup",
      customer_id: customerId,
      contact_name: name,
      contact_phone: phone,
      notes: wants,
      // Midday, so a timezone offset can never move the date onto the day
      // before — the same reason the date helpers work from midday.
      scheduled_for: draft.needBy ? `${draft.needBy}T12:00:00Z` : null,
      // Nothing is priced. A revenue figure on an enquiry is a number the
      // shop has not agreed to and the analytics would count.
      revenue: 0,
    })
    .select("id, ticket")
    .single();

  if (error || !order) {
    return { ok: false, error: error?.message ?? "That didn't send. Please ring the shop." };
  }

  const { error: lineError } = await admin.from("order_lines").insert({
    order_id: order.id,
    // No product: this is a description of something nobody has made.
    product_id: null,
    label: wants.slice(0, 200),
    qty,
    price_at_sale: 0,
    spec: specJson(answersFrom(asked, draft.spec)),
  });

  if (lineError) {
    // An enquiry with nothing in it reads on the board as work with no work
    // in it. Take the header back out rather than leave that.
    await admin.from("orders").delete().eq("id", order.id);
    return { ok: false, error: lineError.message };
  }

  // The whole point of taking enquiries at eleven at night is that somebody
  // finds out. Not awaited: the enquiry is saved, and a push that is slow to
  // send must not be a form that is slow to submit.
  void notifyEnquiry(String(order.id));

  revalidatePath("/admin/orders");
  return { ok: true, ticket: order.ticket === null ? null : Number(order.ticket) };
}
