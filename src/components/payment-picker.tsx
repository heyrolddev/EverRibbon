"use client";
import { money } from "@/lib/format";
import { brand } from "../../config/index.ts";

import Image from "next/image";
import { useState } from "react";
import {
  downpaymentFor,
  type PaymentMethod,
  type PaymentPlan,
  type PaymentSettings,
} from "@/lib/payments";


const fieldClass =
  "rounded-2xl border-2 border-ink-950/15 bg-paper-100 px-5 py-3 font-normal text-ink-950 outline-none transition-colors placeholder:text-ink-900/40 focus:border-brand-700";

function CopyableRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-paper-50 px-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-900/50">
          {label}
        </span>
        <span className="block truncate font-bold text-ink-950">{value}</span>
      </span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            /* clipboard blocked — the number is on screen to read anyway */
          }
        }}
        className="shrink-0 rounded-full bg-ink-950/10 px-3 py-1.5 text-xs font-bold text-ink-950 transition-colors hover:bg-ink-950 hover:text-paper-50"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

export function PaymentPicker({
  settings,
  method,
  onMethodChange,
  plan,
  onPlanChange,
  reference,
  onReferenceChange,
  receipt,
  onReceiptChange,
  total,
  scheduled = false,
}: {
  settings: PaymentSettings;
  method: PaymentMethod;
  onMethodChange: (m: PaymentMethod) => void;
  plan: PaymentPlan;
  onPlanChange: (p: PaymentPlan) => void;
  reference: string;
  onReferenceChange: (v: string) => void;
  receipt: File | null;
  onReceiptChange: (f: File | null) => void;
  total: number;
  /** Ordering ahead — cash isn't an option, because the slot is a booking. */
  scheduled?: boolean;
}) {
  const percent = settings.downpayment_percent;
  const downNow = downpaymentFor(total, percent);
  const balance = total - downNow;
  const offersDownpayment = settings.gcash_enabled && settings.downpayment_enabled;
  const dueNow = plan === "downpayment" ? downNow : total;
  const options: { id: PaymentMethod; label: string; blurb: string; on: boolean }[] = [
    {
      id: "cod",
      label: "Cash",
      blurb: "Pay on delivery or at the stall",
      // A booked slot means materials bought and prep time set aside. Cash
      // on the day doesn't hold either of those, so ordering ahead is paid
      // for. The server enforces this too — this just stops someone picking
      // an option that was only ever going to be rejected.
      on: settings.cod_enabled && !scheduled,
    },
    {
      id: "gcash",
      label: "GCash",
      blurb: "Send now, we confirm it",
      on: settings.gcash_enabled,
    },
  ];
  const available = options.filter((o) => o.on);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-900">
        How are you paying?
      </legend>

      {scheduled && settings.cod_enabled && (
        <p className="rounded-2xl bg-accent-200/20 px-4 py-3 text-sm text-ink-900/80">
          Ordering ahead is paid for up front — in full, or with a down
          payment. It&apos;s what holds your slot: we buy for it and set the
          time aside.
        </p>
      )}

      <div className={`grid gap-3 ${available.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {available.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onMethodChange(o.id)}
            className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
              method === o.id
                ? "border-brand-700 bg-brand-700 text-paper-50"
                : "border-ink-950/15 bg-paper-100 text-ink-900 hover:border-brand-700"
            }`}
          >
            <span className="block font-bold">{o.label}</span>
            <span
              className={`block text-xs ${
                method === o.id ? "text-paper-100/75" : "text-ink-900/55"
              }`}
            >
              {o.blurb}
            </span>
          </button>
        ))}
      </div>

      {method === "gcash" && settings.gcash_enabled && (
        <div className="flex flex-col gap-3 rounded-2xl bg-paper-100 p-5 ring-1 ring-ink-950/10">
          {offersDownpayment && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-ink-900">
                How much are you sending now?
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  {
                    id: "full" as PaymentPlan,
                    title: "Pay in full",
                    amount: total,
                    note: "Nothing left to pay on handover",
                  },
                  {
                    id: "downpayment" as PaymentPlan,
                    title: `${percent}% down payment`,
                    amount: downNow,
                    note: `${money(balance)} in cash on handover`,
                  },
                ]).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => onPlanChange(o.id)}
                    className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                      plan === o.id
                        ? "border-brand-700 bg-brand-700 text-paper-50"
                        : "border-ink-950/15 bg-paper-50 text-ink-900 hover:border-brand-700"
                    }`}
                  >
                    <span className="block text-xs font-bold uppercase tracking-wide opacity-70">
                      {o.title}
                    </span>
                    <span className="block font-display text-2xl font-black">
                      {money(o.amount)}
                    </span>
                    <span
                      className={`block text-xs ${
                        plan === o.id ? "text-paper-100/75" : "text-ink-900/55"
                      }`}
                    >
                      {o.note}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm font-semibold text-ink-950">
            Send {money(dueNow)} to this GCash account, then paste your reference
            number below.
          </p>

          {plan === "downpayment" && offersDownpayment && (
            <p className="rounded-xl bg-accent-50 px-4 py-2.5 text-sm font-semibold text-ink-950 ring-1 ring-accent-200/50">
              Pay {money(downNow)} now · {money(balance)} in cash when you get
              your order.
            </p>
          )}

          {settings.gcash_number && (
            <CopyableRow label="GCash number" value={settings.gcash_number} />
          )}
          {settings.gcash_name && (
            <CopyableRow label="Account name" value={settings.gcash_name} />
          )}

          {settings.gcash_qr_url && (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-paper-50 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink-900/50">
                Or scan this QR
              </span>
              <div className="relative h-44 w-44">
                <Image
                  src={settings.gcash_qr_url}
                  alt={`${brand.name} GCash QR code`}
                  fill
                  sizes="176px"
                  className="object-contain"
                />
              </div>
              <QrDownload url={settings.gcash_qr_url} />
            </div>
          )}

          {/* Either proof is enough — typing a reference off a phone screen is
              error-prone, and a screenshot is often easier and more convincing. */}
          <div className="flex flex-col gap-3 rounded-xl bg-paper-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-900">
              Proof of payment <span className="text-brand-700">*required</span>
            </p>
            <p className="-mt-1 text-[11px] text-ink-900/55">
              Give us <b>either one</b> — whichever is easier on your phone.
            </p>

            <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-widest text-ink-900">
              GCash reference number
              <input
                value={reference}
                onChange={(e) => onReferenceChange(e.target.value)}
                placeholder="e.g. 0053 1234 5678"
                className={fieldClass}
              />
            </label>

            <p className="text-center text-[11px] font-bold uppercase tracking-widest text-ink-900/40">
              or
            </p>

            <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-widest text-ink-900">
              Screenshot of your receipt
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onReceiptChange(e.target.files?.[0] ?? null)}
                className="text-xs font-normal normal-case tracking-normal text-ink-900"
              />
              {receipt && (
                <span className="text-[11px] font-semibold normal-case tracking-normal text-ok-700">
                  ✓ {receipt.name}
                </span>
              )}
            </label>

            <p className="text-[11px] text-ink-900/50">
              We check this against our GCash account before cooking.
            </p>
          </div>

          {settings.instructions && (
            <p className="text-xs text-ink-900/60">{settings.instructions}</p>
          )}
        </div>
      )}

      {method === "cod" && settings.instructions && (
        <p className="text-xs text-ink-900/60">{settings.instructions}</p>
      )}
    </fieldset>
  );
}

/**
 * Save the shop's GCash QR to the phone.
 *
 * A `download` attribute is ignored across origins, so the image is fetched
 * and saved from a blob instead — that's what makes it land in the gallery
 * where the GCash app's own scanner can pick it up. If the fetch is blocked
 * we fall back to opening it, which at least lets them long-press and save.
 */
function QrDownload({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "working" | "saved">("idle");

  async function save() {
    setState("working");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "pepper-pan-gcash-qr.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      setState("saved");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
      setState("idle");
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={state === "working"}
      className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
        state === "saved"
          ? "bg-ok-600 text-paper-50"
          : "bg-ink-950 text-paper-50 hover:bg-brand-700"
      }`}
    >
      {state === "working"
        ? "Saving…"
        : state === "saved"
          ? "Saved to your phone ✓"
          : "⬇ Save QR to scan in GCash"}
    </button>
  );
}
