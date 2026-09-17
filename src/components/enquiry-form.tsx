"use client";

import { useState } from "react";
import Link from "next/link";
import { brand } from "../../config/index.ts";
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

const field =
  "w-full rounded-xl border border-ink-950/15 bg-paper-50 px-4 py-3 text-sm " +
  "text-ink-950 outline-none placeholder:text-ink-900/35 focus:border-brand-600";
const tag = "text-[11px] font-bold uppercase tracking-widest text-ink-900/50";

export function EnquiryForm({
  questions,
  today,
  defaults,
}: {
  questions: SpecQuestion[];
  /** The shop's today, so the date picker cannot offer yesterday. */
  today: string;
  /** What we already know, when somebody is signed in. */
  defaults: { name: string; phone: string };
}) {
  const [name, setName] = useState(defaults.name);
  const [phone, setPhone] = useState(defaults.phone);
  const [wants, setWants] = useState("");
  const [qty, setQty] = useState(1);
  const [needBy, setNeedBy] = useState("");
  const [kind, setKind] = useState("");
  const [spec, setSpec] = useState<Record<string, string>>({});
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
  const [sent, setSent] = useState<{ ticket: number | null } | null>(null);

  const kinds = scopedCategories(questions);
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
    if (res.ok) setSent({ ticket: res.ticket });
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
      <section className="rounded-3xl bg-paper-100 p-6 ring-1 ring-ink-950/10 sm:p-8">
        <label className="flex flex-col gap-1.5">
          <span className={tag}>What would you like?</span>
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

        {/* The shop's own questions, if it has any. A shop that asks nothing
            gets no panel rather than an empty heading. */}
        {(kinds.length > 0 || asked.length > 0) && (
          <div className="mt-6 border-t border-ink-950/10 pt-5">
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
        )}
      </section>

      <section className="rounded-3xl bg-paper-100 p-6 ring-1 ring-ink-950/10 sm:p-8">
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
      </section>
    </div>
  );
}
