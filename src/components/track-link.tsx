"use client";

import { useState } from "react";
import { brand } from "../../config/index.ts";

/**
 * The link to send the customer.
 *
 * Copied rather than sent, because this shop already talks to people
 * somewhere — Messenger, SMS, a reply on Facebook — and a system that insists
 * on being the channel is a system that gets worked around. What matters is
 * that the person who asked can see their price without an account; who
 * carries the message is the shop's business.
 *
 * Built in the browser from `location.origin` so it is right on localhost, on
 * a preview deployment and on the real domain, without a setting that can be
 * wrong on two of the three.
 */
export function TrackLink({ token, name }: { token: string; name: string | null }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    const url = `${window.location.origin}/track/${token}`;
    const message =
      `${name ? `Hi ${name}! ` : ""}Here's your order with ${brand.name}: ${url}`;
    try {
      // The whole message, not the bare link: what actually gets pasted into
      // a chat is a sentence, and asking somebody to type the sentence around
      // it every time is how the link stops being sent.
      await navigator.clipboard.writeText(message);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      // Clipboard denied — an insecure origin, or a browser asking first.
      setState("failed");
    }
  };

  return (
    <button
      onClick={copy}
      className="rounded-full px-3 py-1.5 text-xs font-bold text-ink-900/60 ring-1 ring-ink-950/15 transition-colors hover:bg-ink-950/5 hover:text-ink-950"
    >
      {state === "copied"
        ? "Copied — paste it to them"
        : state === "failed"
          ? `Copy this: /track/${token.slice(0, 8)}…`
          : "Copy their link"}
    </button>
  );
}
