"use client";
import { brand } from "../../config/index.ts";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Marquee } from "@/components/marquee";
import { stripItems } from "@/lib/announcements";
import { Logo } from "@/components/logo";
import { SocialLinks } from "@/components/social-links";

/**
 * The shop's public footer.
 *
 * Hidden on /admin: the owner signs in to run the shop, and a footer inviting
 * them to browse the menu or check "my orders" is noise in a workspace.
 */
export function SiteFooter({
  year,
  staff = false,
}: {
  year: number;
  /** Staff don't order, so the customer's links aren't theirs to follow. */
  staff?: boolean;
}) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  // A landmark, then the town — the order someone needs to get here. Shops
  // whose street line already names the town don't get it twice.
  const { street, locality, region } = brand.contact;
  const address = [street, locality, region]
    .filter((part, i, all) => part && all.indexOf(part) === i)
    .join(", ");

  return (
    <footer className="grain relative overflow-hidden bg-ink-950 text-paper-100">
      <Marquee
        className="border-y border-white/10 py-3 text-sm font-bold uppercase tracking-widest text-accent-200"
        trackClassName="marquee-track--reverse"
        // The same lines the homepage strip falls back to, from the one place
        // that holds them. Two hardcoded lists of a shop's claims is how they
        // end up disagreeing with each other.
        items={stripItems([])}
      />

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-14 sm:grid-cols-3">
        <div>
          <Logo width={220} className="h-auto w-[180px]" />
          <p className="mt-4 text-sm text-paper-100/60">{brand.tagline}</p>

          {/* Marks rather than a list of handles: customers already know
              these shapes, and they read at a glance in a way a spelled-out
              "Instagram @some.long.handle" never will. The name is still
              there for anyone who can't see the icon. */}
          <SocialLinks tone="dark" className="mt-5" />
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent-200">
            Explore
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <Link href="/menu" className="hover:text-accent-300">
                {brand.copy.catalogue}
              </Link>
            </li>
            <li>
              <Link href="/news" className="hover:text-accent-300">
                News &amp; promos
              </Link>
            </li>
            <li>
              <Link href="/#story" className="hover:text-accent-300">
                Our story
              </Link>
            </li>
            <li>
              <Link href="/#visit" className="hover:text-accent-300">
                Visit us
              </Link>
            </li>
            {/* The owner has no orders — theirs land in their own kitchen
                queue — so the link would only ever lead to an empty page. */}
            {!staff && (
              <li>
                <Link href="/orders" className="hover:text-accent-300">
                  My orders
                </Link>
              </li>
            )}
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent-200">
            Say hello
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <a
                href={`tel:${brand.contact.phoneHref}`}
                className="hover:text-accent-300"
              >
                {brand.contact.phone}
              </a>
            </li>
            <li className="text-paper-100/60">{address}</li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 border-t border-white/10 py-5 text-xs text-paper-100/40 sm:flex-row sm:justify-center sm:gap-4">
        <span>© {year} {brand.name}</span>
        <span aria-hidden className="hidden sm:inline">
          ·
        </span>
        <Link href="/terms" className="hover:text-accent-300">
          Terms &amp; conditions
        </Link>
      </div>
    </footer>
  );
}
