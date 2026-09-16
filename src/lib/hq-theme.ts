/**
 * Colour in HQ that means something.
 *
 * Every screen in HQ opened with the same plain black heading, so nothing on
 * the page said which part of the system you were in — you had to look back at
 * the sidebar to know whether you were in the kitchen or in the books. Twenty
 * screens that all look identical is not restraint; it is twenty screens with
 * their labels rubbed off.
 *
 * So the heading takes the colour of the sidebar group it belongs to. That is
 * the whole idea, and it is why this is a map from section to colour rather
 * than a colour picked per page: the accent is not decoration, it is the same
 * fact the sidebar is already telling you, repeated where you are looking.
 *
 *   Every day    gold   — the work of a service
 *   The kitchen  jade   — stock, recipes, what things cost
 *   Understand   chili  — the numbers, and the people
 *   Set up once  ink    — settings, deliberately the quietest
 *   Your data    brand  — backup and start-fresh, the two with consequences
 */

/** Longest-prefix wins, so /admin/orders doesn't answer to /admin. */
const ACCENTS: [prefix: string, colour: string][] = [
  ["/admin/counter", "var(--color-accent-200)"],
  ["/admin/orders", "var(--color-accent-200)"],
  ["/admin/menu", "var(--color-accent-200)"],
  ["/admin/inbox", "var(--color-accent-200)"],

  ["/admin/costing", "var(--color-ok-600)"],
  ["/admin/inventory", "var(--color-ok-600)"],

  ["/admin/analytics", "var(--color-warn-500)"],
  ["/admin/money", "var(--color-warn-500)"],
  ["/admin/reviews", "var(--color-warn-500)"],
  ["/admin/customers", "var(--color-warn-500)"],
  ["/admin/staff", "var(--color-warn-500)"],
  ["/admin/faq", "var(--color-warn-500)"],

  ["/admin/hours", "var(--color-ink-900)"],
  ["/admin/capacity", "var(--color-ink-900)"],
  ["/admin/delivery", "var(--color-ink-900)"],
  ["/admin/payments", "var(--color-ink-900)"],
  ["/admin/alerts", "var(--color-ink-900)"],

  ["/admin/backup", "var(--color-brand-700)"],
  ["/admin/reset", "var(--color-brand-700)"],
];

export function accentFor(pathname: string): string {
  let best = "";
  let colour = "var(--color-accent-200)"; // Today, and anything new.
  for (const [prefix, c] of ACCENTS) {
    if (pathname.startsWith(prefix) && prefix.length > best.length) {
      best = prefix;
      colour = c;
    }
  }
  return colour;
}

/**
 * The heading, everywhere in HQ.
 *
 * A class string rather than a component on purpose: every one of these was
 * already a plain `<h2>` with the same four utilities, so this is a swap and
 * not a rewrite — and a heading that has to be a component is a heading
 * somebody writes by hand the next time they're in a hurry.
 *
 * The accent reads off `--hq-accent`, which the shell sets per section. A page
 * rendered outside the shell still gets a heading, just an ungarnished one,
 * because an undefined custom property makes the border transparent rather
 * than breaking the layout.
 */
export const hqTitle =
  "border-l-[5px] border-[var(--hq-accent,transparent)] pl-3 font-display text-2xl font-black text-ink-950";
