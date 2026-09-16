"use client";

import { brand } from "../../config/index.ts";
import { useEffect } from "react";
import { Logo } from "@/components/logo";
import { usePathname } from "next/navigation";
import { reportClientError } from "@/app/report-error";
import Link from "next/link";

/**
 * What a customer sees when a page fails.
 *
 * Deliberately not the same page as HQ's. A customer does not want a
 * reference number, they want food — so this offers the menu and the phone,
 * and says the one thing they will actually be worried about: whether an
 * order they placed went through.
 *
 * The shop's number is here rather than only in the footer, because the footer
 * is part of the page that just failed to render.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  // Reported as well as logged. The console line helps whoever is looking at
  // this browser; the report is the only way it reaches the owner, who is not.
  useEffect(() => {
    console.error("[shop]", error);
    void reportClientError({
      message: error.message,
      route: pathname,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error, pathname]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-lg rounded-3xl bg-paper-100 p-8 text-center ring-1 ring-ink-950/10">
        {/* The shop's own mark rather than a picture of what it sells: this
            page is the one screen where a customer needs to recognise where
            they still are. */}
        <Logo width={160} className="mx-auto h-auto w-[150px] text-ink-950" />
        <h1 className="mt-5 font-display text-3xl font-black text-ink-950">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-ink-900/70">
          Sorry — this page didn&apos;t load. It&apos;s us, not you. Try again,
          or ring us and we&apos;ll sort it out.
        </p>
        <p className="mt-2 text-sm text-ink-900/70">
          <strong className="text-ink-950">Already ordered?</strong> Your order
          is safe. This is only the page failing to draw, nothing behind it.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-full bg-brand-700 px-6 py-3 text-sm font-bold text-paper-50 transition-transform hover:scale-105"
          >
            Try again
          </button>
          <Link
            href="/menu"
            className="rounded-full bg-ink-950 px-6 py-3 text-sm font-bold text-paper-50 transition-transform hover:scale-105"
          >
            Back to the {brand.copy.catalogue.toLowerCase()}
          </Link>
          <a
            href={`tel:${brand.contact.phoneHref}`}
            className="rounded-full bg-paper-200 px-6 py-3 text-sm font-bold text-ink-950 transition-transform hover:scale-105"
          >
            Call us
          </a>
        </div>

        {error.digest && (
          <p className="mt-6 font-mono text-[11px] text-ink-900/35">
            {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
