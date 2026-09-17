import type { Metadata } from "next";
import { brand } from "../../../config/index.ts";
import { PageHeader } from "@/components/page-header";
import { EnquiryForm } from "@/components/enquiry-form";
import { getSpecQuestions } from "@/lib/spec-server";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/auth";
import { categoriesForAnswers, parseSpec, valuesOf } from "@/lib/spec";
import { shopToday } from "@/lib/format";
import { siteUrl } from "@/lib/site";

/**
 * The door that was not there.
 *
 * Nothing this shop sells exists before somebody asks for it, and until now
 * the only way to start one was a phone call during opening hours. People
 * plan a graduation at eleven at night; the enquiries that arrive then were
 * going to Messenger or nowhere, and either way somebody had to retype them.
 *
 * What arrives here is an order in the shop's first step, carrying the
 * answers to the shop's own questions — so the quote desk opens it already
 * knowing the colours, the name to print and the date.
 */
export const metadata: Metadata = {
  title: "Ask for a price",
  description: `Tell ${brand.name} what you'd like made and get a price and a date back. No payment, no commitment.`,
  alternates: { canonical: "/enquire" },
  openGraph: { url: `${siteUrl()}/enquire`, type: "website" },
};

// The questions can change on any afternoon, and a form asking last week's
// questions is a form collecting answers nobody wanted.
export const revalidate = 60;

export default async function EnquirePage({
  searchParams,
}: {
  /**
   * `?product=…` — what they tapped on the catalogue.
   * `?from=…`    — an order of their own they want again.
   */
  searchParams: Promise<{ product?: string; from?: string }>;
}) {
  const { product: productId, from: repeatOf } = await searchParams;
  const questions = await getSpecQuestions();

  /*
   * What they tapped, if they got here from the catalogue.
   *
   * The form opens knowing it, which is the difference between "tell us what
   * you'd like" and a blank box somebody has to describe their way out of.
   * The price comes with it as a FROM, never as a total — the whole reason
   * this page exists is that the real one depends on what they answer.
   */
  let picked: { name: string; from: number; categories: string[] } | null = null;
  if (productId && isConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("products")
        .select("name, price, categories")
        .eq("id", productId)
        .eq("is_public", true)
        .maybeSingle();
      if (data) {
        picked = {
          name: String(data.name),
          from: Number(data.price) || 0,
          categories: Array.isArray(data.categories) ? data.categories.map(String) : [],
        };
      }
    } catch {
      // A blank form is a working form.
    }
  }

  // Signed in? Then their name and number are already known, and asking for
  // them again is how a form loses somebody at the last field.
  let defaults = { name: "", phone: "" };
  if (isConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .maybeSingle();
        defaults = {
          name: String(data?.full_name ?? ""),
          phone: String(data?.phone ?? ""),
        };
      }
    } catch {
      // An empty form is a working form.
    }
  }

  /*
   * The same again.
   *
   * A regular ordering a second bouquet is ordering last year's bouquet with
   * a different name on it, so the answers come back with the words — and the
   * one thing that actually changes is a single field they can edit.
   *
   * Scoped to their own order by `customer_id`. RLS says the same, but being
   * explicit means a mistake here fails closed rather than handing somebody
   * a stranger's spec.
   */
  let again: { wants: string; spec: Record<string, string>; categories: string[] } | null = null;
  if (repeatOf && !picked && isConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("orders")
          .select("notes, order_lines(label, spec, products(name, categories))")
          .eq("id", repeatOf)
          .eq("customer_id", user.id)
          .maybeSingle();

        const line = (data?.order_lines ?? [])[0];
        if (line) {
          const joined = (Array.isArray(line.products) ? line.products[0] : line.products) as
            | { name?: unknown; categories?: unknown }
            | null
            | undefined;
          const answers = parseSpec(line.spec);
          again = {
            // Their own words first: the notes are what they actually wrote.
            wants: String(data?.notes ?? "").trim() ||
              String(joined?.name ?? line.label ?? "").trim(),
            spec: valuesOf(answers),
            categories: Array.isArray(joined?.categories)
              ? joined.categories.map(String)
              : categoriesForAnswers(questions, answers),
          };
        }
      }
    } catch {
      // A blank form is a working form.
    }
  }

  return (
    <main className="flex-1">
      <PageHeader
        eyebrow={brand.copy.badge}
        title="Ask for a price"
        subtitle="Tell us what you'd like and we'll come back with a price and a date. Nothing is agreed and nothing is owed until you say yes to both."
      />

      <section className="mx-auto max-w-2xl px-6 pb-24 pt-10 sm:pb-32">
        <EnquiryForm
          questions={questions}
          today={shopToday()}
          defaults={defaults}
          picked={picked}
          again={again}
        />
      </section>
    </main>
  );
}
