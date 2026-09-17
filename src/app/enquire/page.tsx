import type { Metadata } from "next";
import { brand } from "../../../config/index.ts";
import { PageHeader } from "@/components/page-header";
import { EnquiryForm } from "@/components/enquiry-form";
import { getSpecQuestions } from "@/lib/spec-server";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/auth";
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

export default async function EnquirePage() {
  const questions = await getSpecQuestions();

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

  return (
    <main className="flex-1">
      <PageHeader
        eyebrow={brand.copy.badge}
        title="Ask for a price"
        subtitle="Tell us what you'd like and we'll come back with a price and a date. Nothing is agreed and nothing is owed until you say yes to both."
      />

      <section className="mx-auto max-w-2xl px-6 pb-24 pt-10 sm:pb-32">
        <EnquiryForm questions={questions} today={shopToday()} defaults={defaults} />
      </section>
    </main>
  );
}
