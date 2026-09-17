import Link from "next/link";
import type { Metadata } from "next";

import { brand } from "../../config/index.ts";
import { mapsHref, siteUrl, streetLine } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { isConfigured } from "@/lib/auth";
import { getOrderStatuses } from "@/lib/order-statuses-server";
import { processSteps } from "@/lib/order-statuses";
import { getPublicReviews } from "@/lib/reviews-server";
import { getSchedule } from "@/lib/hours-server";
import { getLiveAnnouncements } from "@/lib/announcements-server";
import { stripItems } from "@/lib/announcements";
import { DAY_NAMES, type DayHours } from "@/lib/hours";

import { Logo } from "@/components/logo";
import { Marquee } from "@/components/marquee";
import { HowItWorks } from "@/components/how-it-works";
import { ReviewCarousel } from "@/components/review-carousel";
import { FaqAccordion } from "@/components/faq-accordion";
import { SocialLinks } from "@/components/social-links";
import { Stars } from "@/components/stars";
import { Reveal } from "@/components/reveal";
import { RibbonBloom } from "@/components/ribbon-bloom";

/**
 * The shopfront.
 *
 * Nothing on this page is written about one business. The words come from the
 * config, the steps and the hours and the products come from the database, and
 * what is missing is simply not drawn — a shop on its first day, with no
 * products photographed and no reviews yet, gets a page that looks deliberate
 * rather than a page full of empty frames.
 *
 * The order of the sections is the order of a customer's questions. What is
 * this. What do you make. How does buying from you work. Has anyone else done
 * it. Where are you. That last one matters more than it looks: the system this
 * grew from sold to people who had already found the stall, and this one has
 * to sell to people who have not.
 */

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: siteUrl(), type: "website" },
};

// The live parts — promos, hours, what is in stock — are worth a minute at
// most. A homepage that caches for an hour tells people a shop is open when
// it closed at four.
export const revalidate = 60;

type Preview = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
};

/**
 * A handful of what the shop makes.
 *
 * Six, because the job here is to make someone want to see the rest rather
 * than to be the rest — and because three across two rows still looks like a
 * considered selection on a phone, where most of this is read.
 */
async function preview(): Promise<Preview[]> {
  if (!isConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, description, image_url")
      .eq("is_public", true)
      .eq("is_available", true)
      .order("name")
      .limit(6);
    if (error) throw error;
    return (data ?? []) as Preview[];
  } catch {
    // A storefront that will not render because one query failed is worse
    // than a storefront with one section missing.
    return [];
  }
}

async function faqs(): Promise<{ id: number; question: string; answer: string }[]> {
  if (!isConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("faq_entries")
      .select("id, question, answer")
      .eq("is_published", true)
      .order("sort_order")
      .limit(6);
    return (data ?? []) as { id: number; question: string; answer: string }[];
  } catch {
    return [];
  }
}

/** "10:00"–"21:00" as a person says it. */
const clock = (t: string) => {
  const [h = "0", m = "00"] = t.split(":");
  const hour = Number(h);
  const suffix = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return m === "00" ? `${twelve}${suffix}` : `${twelve}:${m}${suffix}`;
};

/**
 * Seven rows of opening hours, folded into the lines a person would say.
 *
 * "Mon–Sat 10am–9pm, Sunday closed" rather than seven identical rows. Runs of
 * days that share hours collapse, which is what makes it readable at a glance
 * and is the reason this is worth twenty lines.
 */
function hourLines(hours: DayHours[]): { days: string; time: string }[] {
  // Monday first: a week that starts on Sunday is a calendar convention, not
  // how anybody describes when they are open.
  const week = [1, 2, 3, 4, 5, 6, 0]
    .map((d) => hours.find((h) => h.weekday === d))
    .filter((h): h is DayHours => Boolean(h));

  const out: { days: string; time: string }[] = [];
  for (const day of week) {
    const time = day.is_open ? `${clock(day.opens)} – ${clock(day.closes)}` : "Closed";
    const name = DAY_NAMES[day.weekday] ?? "";
    const last = out.at(-1);
    if (last && last.time === time) {
      // Extend the run rather than adding a row. The label keeps only its
      // first and last day, so a five-day run reads "Mon – Fri".
      const [first = ""] = last.days.split(" – ");
      last.days = `${first} – ${name.slice(0, 3)}`;
    } else {
      out.push({ days: name.slice(0, 3), time });
    }
  }
  return out;
}

export default async function Home() {
  const [statuses, products, reviewSummary, schedule, live, faqRows] =
    await Promise.all([
      getOrderStatuses(),
      preview(),
      getPublicReviews(9),
      getSchedule(),
      getLiveAnnouncements(),
      faqs(),
    ]);

  const madeToOrder = brand.fulfillment === "made_to_order";
  const catalogue = brand.copy.catalogue;
  const strip = stripItems(live.promos);
  const lines = schedule.configured ? hourLines(schedule.hours) : [];
  // The heading already says the town; this is only the part it has not.
  const street = streetLine();

  // Asked of the steps, not of the element: a heading standing over an empty
  // space is the failure this whole page is written to avoid.
  const hasProcess = processSteps(statuses).length > 0;

  return (
    <main className="flex-1">
      {/* ------------------------------------------------------------ hero -- */}
      {/*
        Full height and mostly empty, on purpose.

        The shop this replaces sold from a stall, where the thing itself was
        the advert. On a screen the equivalent is space: a page that crowds
        four messages above the fold is a page that reads as a flyer, and a
        flyer is not what somebody spending four figures on a graduation
        wants to have found. So there is one picture, one sentence, and one
        thing to do.
      */}
      <section className="under-nav grain relative flex min-h-[100svh] items-center overflow-hidden bg-ink-950 text-paper-100">
        <div
          aria-hidden
          className="hero-grid pointer-events-none absolute inset-0 opacity-20"
        />

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-y-12 px-6 py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-x-16 lg:py-24">
          {/* ---------------------------------------------------- the words -- */}
          <div className="order-2 flex flex-col items-start gap-8 lg:order-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-brand-400/80">
              {brand.copy.badge}
            </p>

            <Logo ground="dark" width={520} priority className="h-auto w-[min(100%,22rem)]" />

            {/*
              The tagline set as the headline, not as a subtitle under the
              mark. It is the only sentence on this screen that says what the
              shop is FOR, and the mark above it only says who.
            */}
            <h1 className="max-w-[16ch] text-balance font-display text-[clamp(2.6rem,6.2vw,4.75rem)] font-black leading-[0.98] tracking-[-0.02em] text-paper-100">
              {brand.tagline}
            </h1>

            <p className="max-w-[46ch] text-base leading-[1.75] text-paper-100/60 sm:text-lg">
              {brand.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/menu"
                className="rounded-full bg-[var(--accent-fill)] px-8 py-4 text-sm font-bold text-[var(--on-accent)] transition-transform hover:scale-105"
              >
                See the {catalogue.toLowerCase()}
              </Link>
              <a
                href={`tel:${brand.contact.phoneHref}`}
                className="rounded-full px-7 py-4 text-sm font-bold text-paper-100 ring-1 ring-paper-100/25 transition-colors hover:bg-paper-100/10"
              >
                {madeToOrder ? "Ask about a custom order" : "Call us"}
              </a>
            </div>
          </div>

          {/* ---------------------------------------------------- the bloom -- */}
          {/*
            First on a phone and second on a desktop. Vertically it is the
            thing worth leading with; horizontally the words have to come
            first, because a left-to-right reader who meets the picture first
            has to come back for them.
          */}
          <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
            <RibbonBloom className="aspect-square w-[min(92vw,27rem)] lg:w-[min(46vw,40rem)]" />
          </div>
        </div>

        {/* The only instruction on the screen, and it is one word. A hero
            this tall has to say there is something under it — and since it
            has to be drawn anyway, it may as well take you there. */}
        <a
          href="#catalogue"
          className="group absolute inset-x-0 bottom-7 mx-auto hidden w-fit flex-col items-center gap-2 sm:flex"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.34em] text-paper-100/35 transition-colors group-hover:text-paper-100/70">
            Scroll
          </span>
          <span
            aria-hidden
            className="h-8 w-px bg-gradient-to-b from-paper-100/35 to-transparent"
          />
        </a>
      </section>

      {/* The live band. Falls back to the standing lines, so it is never an
          empty stripe across the page. */}
      <Marquee
        className="border-y border-ink-950/10 bg-paper-100 py-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-800"
        items={strip}
      />

      {/* ------------------------------------------------------- catalogue -- */}
      <section id="catalogue" className="mx-auto max-w-6xl px-6 py-28 sm:py-40">
        <Reveal>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
                What we make
              </p>
              <h2 className="mt-2 font-display text-3xl font-black text-ink-950 sm:text-4xl">
                {brand.copy.catalogueBlurb.replace(/^./, (c) => c.toUpperCase())}
              </h2>
            </div>
            {products.length > 0 && (
              <Link
                href="/menu"
                className="text-sm font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
              >
                All of it →
              </Link>
            )}
          </header>
        </Reveal>

        {products.length > 0 ? (
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.06}>
                <Link
                  href="/menu"
                  className="group flex h-full flex-col overflow-hidden rounded-3xl bg-paper-100 ring-1 ring-ink-950/10 transition-shadow hover:shadow-lg"
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    // No photograph yet. A tinted panel with the name set in
                    // the shop's own face reads as a choice; a grey box with a
                    // broken-image icon reads as neglect.
                    <div className="grid aspect-[4/3] w-full place-items-center bg-ink-950/90 px-6">
                      <span className="text-center font-display text-2xl text-paper-100/80">
                        {p.name}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-1.5 p-5">
                    <h3 className="font-display text-lg font-black text-ink-950">
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className="line-clamp-2 text-sm text-ink-900/65">
                        {p.description}
                      </p>
                    )}
                    <p className="mt-auto pt-3 font-mono text-sm font-bold text-brand-700">
                      {p.price > 0 ? money(p.price) : "Priced per order"}
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            {/* An empty section is worse than a short one. With nothing to
                show, the space goes to the thing a customer would do next
                anyway — which on a made-to-order shop is talk to somebody. */}
            <div className="mt-8 flex flex-col items-start gap-6 rounded-3xl bg-paper-100 p-8 ring-1 ring-ink-950/10 sm:p-10">
              <p className="max-w-[54ch] text-base leading-relaxed text-ink-900/70">
                {madeToOrder ? (
                  <>
                    Nothing here is off a shelf, so the best place to start is a
                    conversation. Tell us what the occasion is and when you need
                    it, and we&apos;ll come back with a price.
                  </>
                ) : (
                  <>
                    The {catalogue.toLowerCase()} is being set up. Give us a ring
                    in the meantime — we can take an order over the phone.
                  </>
                )}
              </p>
              <a
                href={`tel:${brand.contact.phoneHref}`}
                className="rounded-full bg-[var(--accent-fill)] px-6 py-3 text-sm font-bold text-[var(--on-accent)] transition-transform hover:scale-105"
              >
                {brand.contact.phone}
              </a>
            </div>
          </Reveal>
        )}
      </section>

      {/* -------------------------------------------------- how it works -- */}
      {hasProcess && (
      <section id="how" className="bg-paper-100 py-28 sm:py-40">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
              How it works
            </p>
            <h2 className="mt-2 max-w-[20ch] font-display text-3xl font-black text-ink-950 sm:text-4xl">
              {madeToOrder
                ? "From the first message to the day you need it"
                : "From your order to your hands"}
            </h2>
            <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-ink-900/65">
              These are the same steps your order moves through on our side, so
              you can see exactly where yours is at any point.
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-10">
              <HowItWorks statuses={statuses} />
            </div>
          </Reveal>
        </div>
      </section>
      )}

      {/* ---------------------------------------------------------- proof -- */}
      {reviewSummary.count > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-28 sm:py-40">
          <Reveal>
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
                  From the people who ordered
                </p>
                <h2 className="mt-2 flex items-center gap-3 font-display text-3xl font-black text-ink-950 sm:text-4xl">
                  {reviewSummary.average.toFixed(1)}
                  <Stars rating={reviewSummary.average} />
                </h2>
                <p className="mt-1 text-sm text-ink-900/60">
                  {reviewSummary.count} review{reviewSummary.count === 1 ? "" : "s"}
                </p>
              </div>
              <Link
                href="/reviews"
                className="text-sm font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
              >
                Read them all →
              </Link>
            </header>
          </Reveal>
          <div className="mt-10">
            <ReviewCarousel reviews={reviewSummary.reviews} />
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------- find -- */}
      <section id="visit" className="bg-ink-950 py-28 text-paper-100 sm:py-40">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2">
          <Reveal>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-brand-400">
              Find us
            </p>
            <h2 className="mt-2 font-display text-3xl font-black sm:text-4xl">
              {brand.contact.locality}, {brand.contact.region}
            </h2>
            {street && (
              <p className="mt-4 max-w-[42ch] leading-relaxed text-paper-100/65">
                {street}
              </p>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={`tel:${brand.contact.phoneHref}`}
                className="rounded-full bg-[var(--accent-fill)] px-6 py-3 text-sm font-bold text-[var(--on-accent)] transition-transform hover:scale-105"
              >
                {brand.contact.phone}
              </a>
              {/* The shop's listing when it has one, a search for its own
                  address when it does not. What is never drawn is a link
                  built on a coordinate nobody measured. */}
              {mapsHref() && (
                <a
                  href={mapsHref()!}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full px-6 py-3 text-sm font-bold ring-1 ring-paper-100/30 transition-colors hover:bg-paper-100/10"
                >
                  Open in maps
                </a>
              )}
            </div>

            {brand.socials.length > 0 && <SocialLinks tone="dark" className="mt-7" />}
          </Reveal>

          {lines.length > 0 && (
            <Reveal delay={0.08}>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-brand-400">
                Open
              </p>
              <dl className="mt-4 flex flex-col">
                {lines.map((l) => (
                  <div
                    key={l.days}
                    className="flex items-baseline justify-between gap-6 border-b border-white/10 py-3 text-sm"
                  >
                    <dt className="font-semibold">{l.days}</dt>
                    <dd
                      className={`tabular-nums ${
                        l.time === "Closed" ? "text-paper-100/40" : "text-paper-100/80"
                      }`}
                    >
                      {l.time}
                    </dd>
                  </div>
                ))}
              </dl>
              {!schedule.state.isOpen && schedule.state.opensNext && (
                <p className="mt-4 text-sm text-paper-100/60">
                  Closed right now — {schedule.state.opensNext.toLowerCase()}. You
                  can still order ahead.
                </p>
              )}
            </Reveal>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ faq -- */}
      {faqRows.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 py-28 sm:py-40">
          <Reveal>
            <h2 className="font-display text-3xl font-black text-ink-950 sm:text-4xl">
              Before you ask
            </h2>
          </Reveal>
          <div className="mt-8">
            <FaqAccordion
              items={faqRows.map((f) => ({
                question: f.question,
                answer: f.answer,
              }))}
            />
          </div>
        </section>
      )}
    </main>
  );
}
