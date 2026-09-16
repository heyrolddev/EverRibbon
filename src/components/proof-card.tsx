"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { formatDateTime } from "@/lib/format";
import {
  CHANGE_REPLY_MAX,
  changeRequests,
  currentProof,
  proofState,
  type Proof,
} from "@/lib/proofs";
import { decideProof } from "@/app/orders/actions";

/**
 * The photograph, and the two words that decide whether it gets made.
 *
 * This is the highest-stakes thing a customer touches on this site. They have
 * paid a deposit on something that does not exist, and this is the moment
 * they find out whether it is what they meant — so it is drawn large, the
 * shop's question is right beside it, and "Ask for a change" is as easy to
 * reach as "Approve". A layout that makes approval the only comfortable
 * button is a layout that collects approvals nobody meant.
 */
export function ProofCard({ proofs }: { proofs: Proof[] }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const current = currentProof(proofs);
  const state = proofState(proofs);
  const history = changeRequests(proofs);

  if (!current) return null;

  function decide(decision: "approved" | "changes") {
    if (!current) return;
    setError(null);
    start(async () => {
      const res = await decideProof({ proofId: current.id, decision, reply });
      if (!res.ok) return setError(res.error);
      setAsking(false);
      setReply("");
      router.refresh();
    });
  }

  return (
    <div className="border-t border-ink-950/10 px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-black text-ink-950">
          {state === "approved"
            ? "You approved this"
            : state === "rework"
              ? "We're making the change you asked for"
              : "Have a look before we make it"}
        </h3>
        <span className="font-mono text-[11px] text-ink-900/45">
          {current.version > 1 ? `Version ${current.version} · ` : ""}
          {formatDateTime(current.sentAt)}
        </span>
      </div>

      {current.note && (
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-900/75">
          {current.note}
        </p>
      )}

      {/* Large, and the whole thing — a proof cropped to a tidy square is a
          proof of something else. Clicking opens the full file, because the
          detail somebody wants to check is usually the spelling. */}
      <a
        href={current.imageUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 block overflow-hidden rounded-2xl bg-ink-950/5 ring-1 ring-ink-950/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.imageUrl}
          alt={`Proof, version ${current.version}`}
          className="max-h-[28rem] w-full object-contain"
        />
      </a>

      {state === "waiting" && (
        <>
          <AnimatePresence initial={false}>
            {asking ? (
              <motion.div
                key="ask"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="mt-4 block">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-ink-900/50">
                    What should be different?
                  </span>
                  <textarea
                    autoFocus
                    rows={3}
                    maxLength={CHANGE_REPLY_MAX}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="The maroon is a bit light, and the second name is spelled Krizzia."
                    className="mt-1.5 w-full rounded-xl border border-ink-950/15 bg-paper-50 px-3 py-2 text-sm outline-none placeholder:text-ink-900/35 focus:border-brand-600"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => decide("changes")}
                    disabled={pending}
                    className="rounded-full bg-ink-950 px-5 py-2.5 text-sm font-bold text-paper-50 transition-transform hover:scale-105 disabled:opacity-40"
                  >
                    {pending ? "Sending…" : "Send this back"}
                  </button>
                  <button
                    onClick={() => setAsking(false)}
                    disabled={pending}
                    className="rounded-full px-4 py-2.5 text-sm font-bold text-ink-900/60 hover:text-ink-950"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="decide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex flex-wrap gap-2"
              >
                <button
                  onClick={() => decide("approved")}
                  disabled={pending}
                  className="rounded-full bg-ok-700 px-6 py-3 text-sm font-bold text-paper-50 transition-transform hover:scale-105 disabled:opacity-40"
                >
                  {pending ? "…" : "Approve — make it"}
                </button>
                {/* Same size, same row. Making this the small grey link is how
                    a shop collects approvals from people who had a doubt. */}
                <button
                  onClick={() => setAsking(true)}
                  disabled={pending}
                  className="rounded-full px-6 py-3 text-sm font-bold text-ink-950 ring-1 ring-ink-950/20 transition-colors hover:bg-ink-950/5 disabled:opacity-40"
                >
                  Ask for a change
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-3 text-xs text-ink-900/55">
            Nothing is cut or printed until you approve, so take your time —
            and check the spelling.
          </p>
        </>
      )}

      {state === "approved" && current.decidedAt && (
        <p className="mt-3 text-sm text-ok-700">
          Approved {formatDateTime(current.decidedAt)}. We&apos;re on it.
        </p>
      )}

      {state === "rework" && current.reply && (
        <p className="mt-3 rounded-xl bg-warn-500/10 px-4 py-3 text-sm text-ink-900/80">
          <strong className="text-ink-950">You asked for:</strong> {current.reply}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-bad-700">{error}</p>}

      {/* Everything asked for so far, once there is more than one round. The
          shop is making the thing from this list, so the customer should be
          able to see the same list. */}
      {history.length > 0 && state !== "rework" && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-bold text-ink-900/55 hover:text-ink-950">
            Earlier changes you asked for ({history.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs text-ink-900/70">
            {history.map((h) => (
              <li key={h.version}>
                <span className="font-mono text-ink-900/45">v{h.version}</span>{" "}
                {h.reply}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
