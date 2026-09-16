"use client";

import { useState, useTransition } from "react";
import { saveOperating } from "@/app/admin/capacity/actions";
import { money, duration, formatDate } from "@/lib/format";
import { brand } from "../../config/index.ts";
import type { CapacityDay, Operating } from "@/lib/operating";

/**
 * What the shop can still take, and the numbers that decide it.
 *
 * The calendar counts minutes rather than orders. A day holding one bouquet
 * and a day holding twenty printed ribbons are not the same day, and a board
 * that counts orders oversells the first while refusing the second.
 */
export function CapacityView({
  days,
  operating,
  costedProducts,
}: {
  days: CapacityDay[];
  operating: Operating;
  /** How many products have had their assembly time measured, out of how many. */
  costedProducts: { timed: number; total: number };
}) {
  return (
    <div className="flex flex-col gap-8">
      <Calendar days={days} />
      <Numbers operating={operating} costedProducts={costedProducts} />
    </div>
  );
}

function Calendar({ days }: { days: CapacityDay[] }) {
  const working = days.filter((d) => !d.isClosed);
  const freeTotal = working.reduce((s, d) => s + d.free, 0);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-black text-ink-950">The next two weeks</h3>
        <p className="text-sm text-ink-900/60">
          {duration(freeTotal)} free across {working.length} working days
        </p>
      </div>

      <ol className="flex flex-col gap-1.5">
        {days.map((d) => (
          <Day key={d.day} day={d} />
        ))}
      </ol>

      <p className="max-w-[60ch] text-xs leading-relaxed text-ink-900/55">
        A full day is one with no assembly minutes left, not one with a certain
        number of orders on it. Component runs are not counted here — those are
        replenishment, scheduled against stock rather than against a customer&apos;s
        date, and counting them would refuse work the shop can actually take.
      </p>
    </section>
  );
}

function Day({ day }: { day: CapacityDay }) {
  const used = day.ceiling > 0 ? Math.min(100, (day.booked / day.ceiling) * 100) : 0;

  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ${
        day.isClosed
          ? "bg-ink-950/[0.03] ring-ink-950/5"
          : day.isFull
            ? "bg-bad-50 ring-bad-700/20"
            : "bg-paper-50 ring-ink-950/10"
      }`}
    >
      <span className="w-28 shrink-0 text-sm font-bold text-ink-950">{formatDate(day.day)}</span>

      <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-ink-950/10">
        {!day.isClosed && (
          <span
            className={`absolute inset-y-0 left-0 rounded-full ${day.isFull ? "bg-bad-700" : "bg-ok-700"}`}
            style={{ width: `${used}%` }}
          />
        )}
      </span>

      <span className="w-40 shrink-0 text-right text-xs tabular-nums text-ink-900/70">
        {day.isClosed ? (
          <span className="font-semibold text-ink-900/45">Not working</span>
        ) : day.isFull ? (
          <span className="font-bold text-bad-700">Full · {day.orders} orders</span>
        ) : (
          <>
            {duration(day.free)} free
            {day.orders > 0 && <span className="text-ink-900/45"> · {day.orders}</span>}
          </>
        )}
      </span>
    </li>
  );
}

function Numbers({
  operating,
  costedProducts,
}: {
  operating: Operating;
  costedProducts: { timed: number; total: number };
}) {
  const [form, setForm] = useState(operating);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (k: keyof Operating) => (v: string) => {
    setForm((f) => ({ ...f, [k]: Number(v) }));
    setSaved(false);
  };

  function submit() {
    setError(null);
    start(async () => {
      const res = await saveOperating({
        capacityMinutesPerDay: form.capacityMinutesPerDay,
        labourRatePerHour: form.labourRatePerHour,
        consumablesPerUnit: form.consumablesPerUnit,
        consumablesPerOrder: form.consumablesPerOrder,
        depositCoolingOffMinutes: form.depositCoolingOffMinutes,
        rushWindowDays: form.rushWindowDays,
        rushFeePercent: form.rushFeePercent,
      });
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  const hourly = form.labourRatePerHour;

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-paper-50 p-6 ring-1 ring-ink-950/10">
      <div>
        <h3 className="font-display text-lg font-black text-ink-950">Your numbers</h3>
        <p className="mt-1 max-w-[62ch] text-sm text-ink-900/65">
          Every price and every free minute on this page comes from these. Change
          one and the whole shop re-prices — no deploy, no developer.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Minutes of work a day holds"
          hint="Ten hours is 600. The calendar measures a day against this."
          value={form.capacityMinutesPerDay}
          onChange={set("capacityMinutesPerDay")}
          suffix="min"
        />
        <Field
          label="Your rate an hour"
          hint={
            hourly > 0
              ? `A 28-minute assembly costs ${money((28 / 60) * hourly)}.`
              : "Left at zero, labour is not costed at all — and a slow product looks as cheap as a fast one."
          }
          value={form.labourRatePerHour}
          onChange={set("labourRatePerHour")}
          prefix={brand.currency.symbol}
        />
        <Field
          label="Consumables per item made"
          hint="Glue, tape, the small things that scale with how many you make."
          value={form.consumablesPerUnit}
          onChange={set("consumablesPerUnit")}
          prefix={brand.currency.symbol}
        />
        <Field
          label="Consumables per order"
          hint="What each order costs regardless of its size."
          value={form.consumablesPerOrder}
          onChange={set("consumablesPerOrder")}
          prefix={brand.currency.symbol}
        />
        <Field
          label="Deposit stays refundable for"
          hint="Counted from the moment work starts, not back from the due date — the irreversible act is cutting stock, not the calendar turning."
          value={form.depositCoolingOffMinutes}
          onChange={set("depositCoolingOffMinutes")}
          suffix="min"
        />
        <Field
          label="Rush window"
          hint="A date this close is offered with a surcharge, never refused."
          value={form.rushWindowDays}
          onChange={set("rushWindowDays")}
          suffix="days"
        />
        <Field
          label="Rush surcharge"
          hint="Added to an order inside the window."
          value={form.rushFeePercent}
          onChange={set("rushFeePercent")}
          suffix="%"
        />
      </div>

      {costedProducts.timed < costedProducts.total && (
        <p className="rounded-xl bg-warn-50 px-4 py-3 text-sm text-warn-700 ring-1 ring-warn-700/20">
          <strong>
            {costedProducts.total - costedProducts.timed} of {costedProducts.total} products
          </strong>{" "}
          have no assembly time set, so they take no room on the calendar and cost
          nothing in labour. A day can read as free while it is already spoken for.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-bold text-paper-50 transition-opacity disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm font-semibold text-ok-700">Saved.</span>}
        {error && <span className="text-sm font-semibold text-bad-700">{error}</span>}
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-ink-950">{label}</span>
      <span className="flex items-center gap-1.5 rounded-xl bg-paper-100 px-3 py-2 ring-1 ring-ink-950/10 focus-within:ring-2 focus-within:ring-brand-700">
        {prefix && <span className="text-sm text-ink-900/50">{prefix}</span>}
        <input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold tabular-nums text-ink-950 outline-none"
        />
        {suffix && <span className="text-sm text-ink-900/50">{suffix}</span>}
      </span>
      <span className="text-xs leading-relaxed text-ink-900/55">{hint}</span>
    </label>
  );
}
