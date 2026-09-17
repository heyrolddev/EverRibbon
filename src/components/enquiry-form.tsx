"use client";

import { useState } from "react";
import Link from "next/link";
import { brand } from "../../config/index.ts";
import { money } from "@/lib/format";
import { SpecFields } from "@/components/spec-fields";
import { missingRequired, questionsFor, scopedCategories, type SpecQuestion } from "@/lib/spec";
import { ReferencePicker, type Reference } from "@/components/reference-picker";
import { sendEnquiry } from "@/app/enquire/actions";

/**
 * Asking for something that does not exist yet.
 *
 * The questions are the shop's own — the same rows the quote desk asks, which
 * is the whole reason this form can exist without anybody writing it a second
 * time. A shop that changes what it asks changes this form by changing that.
 *
 * Deliberately short. Every field here is one a person might stall on at
 * eleven at night on a phone, and an enquiry that does not arrive is worth
 * less than one that arrives half-answered — so only the name, a number and
 * what they want are required, and the date is the one thing asked for that
 * they are likely not to know.
 */

/**
 * A numbered heading.
 *
 * Three of them, and that is the point: a form whose end you can see is a
 * form people finish. This one has six fields and two of them are optional,
 * but without the numbers it reads as "scroll until something happens".
 */
function Step({ n, of, title, children }: { n: number; of: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-paper-100 p-6 ring-1 ring-ink-950/10 sm:p-8">
      <p className="flex items-center gap-2.5">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent-fill)] font-mono text-[11px] font-black text-[var(--on-accent)]">
          {n}
        </span>
        <span className="font-display text-lg font-black text-ink-950">{title}</span>
        <span className="ml-auto font-mono text-[11px] text-ink-900/40">
          {n} / {of}
        </span>
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const field =
  "w-full rounded-xl border border-ink-950/15 bg-paper-50 px-4 py-3 text-sm " +
  "text-ink-950 outline-none placeholder:text-ink-900/35 focus:border-brand-600";
const tag = "text-[11px] font-bold uppercase tracking-widest text-ink-900/50";

export function EnquiryForm({
  questions,
  today,
  defaults,
  picked,
  again,
}: {
  questions: SpecQuestion[];
  /** The shop's today, so the date picker cannot offer yesterday. */
  today: string;
  /** What we already know, when somebody is signed in. */
  defaults: { name: string; phone: string };
  /** What they tapped on the catalogue, when they came from there. */
  picked?: { name: string; from: number; categories: string[] } | null;
  /** An order of their own they asked to repeat, answers and all. */
  again?: { wants: string; spec: Record<string, string>; categories: string[] } | null;
}) {
  const [name, setName] = useState(defaults.name);
  const [phone, setPhone] = useState(defaults.phone);
  const [wants, setWants] = useState(again?.wants ?? picked?.name ?? "");
  const [qty, setQty] = useState(1);
  const [needBy, setNeedBy] = useState("");
  // The kind of work comes with the product they tapped, so the right
  // questions are already on screen rather than behind a dropdown nobody
  // knows to open.
  const [kind, setKind] = useState(again?.categories[0] ?? picked?.categories[0] ?? "");
  // Last time's answers, so "the same again" means the same again — and the
  // one thing that changes is a field they edit rather than a form they refill.
  const [spec, setSpec] = useState<Record<string, string>>(again?.spec ?? {});
  const [photos, setPhotos] = useState<Reference[]>([]);
  /*
   * Whether they have tried to send yet.
   *
   * Nothing is marked missing before this. A required field outlined in red
   * on a form nobody has touched reads as an error the visitor has already
   * made, on a page whose whole job is to be easy to start.
   */
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ ticket: number | null; token: string | null } | null>(null);

  const kinds = scopedCategories(questions);
  // Two steps or three, decided by whether this shop asks anything. A "2 / 3"
  // over a step that does not exist is worse than no number at all.
  const hasQuestions = kinds.length > 0 || questionsFor(questions, []).length > 0;
  const steps = hasQuestions ? 3 : 2;
  const asked = questionsFor(questions, kind ? [kind] : []);
  const gaps = missingRequired(asked, spec).map((q) => q.key);

  const submit = async () => {
    setTried(true);
    if (gaps.length > 0) {
      // Named, not just outlined. The missing field can be off the screen.
      return setError(
        `Still needed: ${missingRequired(asked, spec).map((q) => q.label).join(", ")}.`
      );
    }
    setSending(true);
    setError(null);
    const res = await sendEnquiry({
      name,
      phone,
      wants,
      qty,
      needBy,
      categories: kind ? [kind] : [],
      spec,
      // The shrunk files, sent in the same request. No separate upload
      // endpoint: an anonymous door that accepts photographs is a door, and
      // this form already has one that is rate-limited and checked.
      photos: photos.map((p) => p.file),
    });
    setSending(false);
    if (res.ok) setSent({ ticket: res.ticket, token: res.token });
    else setError(res.error);
  };

  if (sent) {
    return (
      <div className="rounded-3xl bg-paper-100 p-8 ring-1 ring-ink-950/10">
        <h2 className="font-display text-2xl font-black text-ink-950">
          We&apos;ve got it{sent.ticket ? `, #${sent.ticket}` : ""}.
        </h2>
        <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-ink-900/70">
          Someone will come back to you on {phone || "the number you gave"} with
          a price and a date. Nothing is agreed and nothing is owed until you
          say yes to both.
        </p>
        {/* Their own link, given now rather than left for the shop to send.
            It is where the price will appear, so it is the one thing on this
            screen worth keeping. */}
        {sent.token && (
          <Link
            href={`/track/${sent.token}`}
            className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-ink-950 px-5 py-4 text-paper-100 transition-transform hover:scale-[1.01]"
          >
            <span>
              <span className="block text-[11px] font-bold uppercase tracking-widest text-brand-400">
                Keep this
              </span>
              <span className="text-sm">
                Your price and where it&apos;s up to will show here
              </span>
            </span>
            <span aria-hidden className="text-lg">→</span>
          </Link>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={`tel:${brand.contact.phoneHref}`}
            className="rounded-full bg-[var(--accent-fill)] px-6 py-3 text-sm font-bold text-[var(--on-accent)] transition-transform hover:scale-105"
          >
            Or ring us now
          </a>
          <Link
            href="/menu"
            className="rounded-full px-5 py-3 text-sm font-bold text-ink-950 ring-1 ring-ink-950/15 transition-colors hover:bg-ink-950/5"
          >
            See the {brand.copy.catalogue.toLowerCase()}
          </Link>
        </div>
      </div>
    );
  }

  const usable = name.trim().length >= 2 && phone.trim().length >= 7 && wants.trim().length >= 4;

  return (
    <div className="flex flex-col gap-6">
      <Step n={1} of={steps} title="What would you like?">
        {/* What they tapped, so the form opens knowing it. The price is a
            FROM and never a total: the real one depends on the answers
            below, which is the whole reason this page exists. */}
        {picked && (
          <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-paper-50 px-4 py-3 text-sm ring-1 ring-ink-950/10">
            <span className="font-bold text-ink-950">{picked.name}</span>
            {picked.from > 0 && (
              <span className="text-ink-900/60">from {money(picked.from)}</span>
            )}
          </p>
        )}
        <label className="flex flex-col gap-1.5">
          <span className={tag}>In your own words</span>
          <textarea
            rows={3}
            value={wants}
            onChange={(e) => setWants(e.target.value)}
            placeholder="e.g. a bouquet for a college graduation, maroon and gold, with her name on the ribbon"
            className={field}
          />
        </label>

        <ReferencePicker photos={photos} onChange={setPhotos} />

        <div className="mt-4 grid gap-4 sm:grid-cols-[6rem_minmax(0,1fr)]">
          <label className="flex flex-col gap-1.5">
            <span className={tag}>How many</span>
            <input
              type="number"
              min={1}
              max={999}
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 1)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={tag}>When do you need it?</span>
            <input
              type="date"
              min={today}
              value={needBy}
              onChange={(e) => setNeedBy(e.target.value)}
              className={field}
            />
          </label>
        </div>

      </Step>

      {/* The shop's own questions, if it has any. A shop that asks nothing
          gets two steps rather than an empty third. */}
      {hasQuestions && (
        <Step n={2} of={steps} title="A few details">
          <div>
            {kinds.length > 0 && (
              <label className="flex flex-col gap-1.5">
                <span className={tag}>What kind of work is it?</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className={`${field} ${kind ? "" : "text-ink-900/45"}`}
                >
                  <option value="">Not sure yet</option>
                  {kinds.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <SpecFields
              questions={asked}
              values={spec}
              missing={tried ? gaps : []}
              onChange={(key, value) => setSpec((s) => ({ ...s, [key]: value }))}
            />
            <p className="mt-3 text-xs text-ink-900/50">
              Answer what you know — anything blank we&apos;ll ask about when we
              come back to you. The ones marked{" "}
              <span className="font-bold text-brand-700">*</span> we do need.
            </p>
          </div>
        </Step>
      )}

      <Step n={steps} of={steps} title="How we reach you">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={tag}>Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Krizzia Santos"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={tag}>Number we can reach you on</span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912 345 6789"
              className={field}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            onClick={submit}
            disabled={!usable || sending}
            className="rounded-full bg-[var(--accent-fill)] px-8 py-4 text-sm font-bold text-[var(--on-accent)] transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
          >
            {sending ? "Sending…" : "Send the enquiry"}
          </button>
          <span className="text-xs text-ink-900/55">
            No payment, no commitment — just a price and a date.
          </span>
        </div>

        {error && <p className="mt-4 text-sm font-semibold text-bad-700">{error}</p>}
      </Step>
    </div>
  );
}
