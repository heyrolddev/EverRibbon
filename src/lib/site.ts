import { brand } from "../../config/index.ts";

/**
 * The shop's own facts, and its address on the internet.
 *
 * This file used to *be* the facts — a name, a street, a phone number and a
 * map pin, typed in. It is now a view onto the config, and that is the whole
 * difference between a website and a system: the same code below serves a
 * ribbon shop in Pampanga and a food stall two streets away, and neither
 * appears in it.
 */
export const SHOP = {
  name: brand.name,
  tagline: brand.tagline,
  description: brand.description,
  locale: brand.locale,
  fulfillment: brand.fulfillment,
  copy: brand.copy,
  ...brand.contact,
} as const;

export const SOCIALS = brand.socials;

/**
 * The shop's address as one line, without saying the town twice.
 *
 * A shop whose street line is a landmark reads "In front of the market,
 * Apalit, Pampanga". One whose street line IS the town read "Apalit, Apalit,
 * Pampanga" on the footer and "Apalit" under a heading that already said
 * "Apalit, Pampanga" on the homepage. Same rule, one place.
 */
export function addressLine(): string {
  const { street, locality, region } = brand.contact;
  return [street, locality, region]
    .filter((part, i, all) => part && all.indexOf(part) === i)
    .join(", ");
}

/** Just the part the heading has not already said. */
export function streetLine(): string | null {
  const { street, locality } = brand.contact;
  return street && street !== locality ? street : null;
}

/**
 * Absolute URLs, which share cards require — a relative image path is simply
 * ignored by the chat apps, and the failure looks like "the picture doesn't
 * show up" with nothing in any log.
 *
 * Set NEXT_PUBLIC_SITE_URL once the shop has its own domain. Until then the
 * host names the production deployment for us, so sharing works before anyone
 * has bought anything.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
