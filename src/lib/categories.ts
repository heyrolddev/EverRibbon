/**
 * Colours for the kinds of food this shop sells.
 *
 * A category used to be a string typed into one box on one product, which meant
 * "Chicken", "chicken" and "Chicken " were three categories, and the filter
 * bar on the customer menu showed all three. Now they are rows in a table, and
 * a row can carry a colour.
 *
 * The colour is a TOKEN, not a hex code, and that is the important decision
 * here. Two reasons, and both of them bite in practice:
 *
 *   Tailwind builds its stylesheet by reading the source, so a class name
 *   assembled at runtime from a hex in the database produces no CSS at all —
 *   the chip renders with no colour and nothing anywhere reports an error.
 *
 *   And a freely-picked colour can land anywhere, including pale yellow text
 *   on cream. A fixed set is not a limitation the owner has to work around;
 *   it is the guarantee that whatever they pick is still readable on the
 *   customer's phone in daylight.
 *
 * Eight is enough for a street-food menu and few enough that two categories
 * are never nearly the same colour — which is the whole point of colouring
 * them.
 */

export type CategoryTone = {
  /**
   * What the owner picks from.
   *
   * A handle, not a promise: the swatch beside it is the truth, because the
   * actual hue is the brand's and changes with the brand. The names used to
   * be a food shop's — "Red", "Yellow", "Brown" — and on a gold brand "Red"
   * painted dark gold and "Yellow" painted the same dark gold.
   */
  label: string;
  /** Filled chip — the selected filter, and the badge on a card. */
  chip: string;
  /** The same colour, quietly — an unselected filter or a label on a card. */
  soft: string;
  /**
   * A panel-sized tint, for a card with no photograph on it yet.
   *
   * Stronger than `soft` on purpose. A 16-pixel chip and a 300-pixel panel
   * are not the same alpha: at 12% a chip is a colour and a panel is a shade
   * of the paper it sits on, which is how six categories came out as six
   * slightly different greys.
   */
  wash: string;
  /** Just the colour, for a dot or a rail. */
  dot: string;
  /**
   * The palette keys behind `chip` and `wash`.
   *
   * Named separately because Tailwind compiles class names by reading the
   * source, so the classes above have to be literal strings — and a literal
   * string is not something a test can measure. These are what the contrast
   * test reads.
   */
  tokens: {
    fill: string;
    on: string;
    wash: string;
    /** As a fraction, matching the `/NN` modifier on the class. */
    washAlpha: number;
    washOn: string;
  };
};

/**
 * One tone per ramp in the brand's own palette.
 *
 * They used to be eight hand-named colours, and on this brand four of them
 * collided: "Red" and "Yellow" were both `brand-800`, "Black" and "Brown"
 * were both `ink-950`. Worse, the shop's own catalogue seed had coloured its
 * six categories `brand, accent, ok, warn, ink, paper` — four of which were
 * not keys here at all, so four categories fell back to black and the menu
 * came out a wall of identical chips.
 *
 * Keyed by ramp instead. That makes them exactly as distinct as the palette
 * is, which the palette test already holds to ΔE 20 apart — so every shop
 * that installs this gets six genuinely different colours in its own brand
 * without anybody choosing them.
 *
 * `bad` is deliberately not offered. Using the danger ramp for decoration is
 * the "amber warning on a gold brand" mistake pointing the other way: it
 * spends the one colour that has to mean something is wrong.
 */
export const CATEGORY_TONES: Record<string, CategoryTone> = {
  brand: {
    label: "Brand colour",
    chip: "bg-brand-800 text-paper-50",
    soft: "bg-brand-800/12 text-brand-900",
    wash: "bg-brand-400/30 text-brand-900",
    // Mid-ramp for the dot: the 800 is nearly black at 16 pixels across, and
    // a swatch nobody can tell from the next one is not a swatch.
    dot: "bg-brand-500",
    tokens: { fill: "brand-800", on: "paper-50", wash: "brand-400", washAlpha: 0.3, washOn: "brand-900" },
  },
  accent: {
    label: "Accent",
    chip: "bg-accent-800 text-paper-50",
    soft: "bg-accent-800/12 text-accent-900",
    wash: "bg-accent-300/35 text-accent-900",
    dot: "bg-accent-500",
    tokens: { fill: "accent-800", on: "paper-50", wash: "accent-300", washAlpha: 0.35, washOn: "accent-900" },
  },
  ok: {
    label: "Green",
    chip: "bg-ok-700 text-paper-50",
    soft: "bg-ok-700/12 text-ok-800",
    wash: "bg-ok-400/40 text-ok-900",
    dot: "bg-ok-600",
    tokens: { fill: "ok-700", on: "paper-50", wash: "ok-400", washAlpha: 0.4, washOn: "ok-900" },
  },
  warn: {
    label: "Orange",
    chip: "bg-warn-700 text-paper-50",
    soft: "bg-warn-700/12 text-warn-800",
    wash: "bg-warn-300/40 text-warn-900",
    dot: "bg-warn-500",
    tokens: { fill: "warn-700", on: "paper-50", wash: "warn-300", washAlpha: 0.4, washOn: "warn-900" },
  },
  ink: {
    label: "Black",
    chip: "bg-ink-950 text-paper-50",
    soft: "bg-ink-950/8 text-ink-950",
    wash: "bg-ink-300/45 text-ink-950",
    dot: "bg-ink-950",
    tokens: { fill: "ink-950", on: "paper-50", wash: "ink-300", washAlpha: 0.45, washOn: "ink-950" },
  },
  paper: {
    // The one light fill, which is why it takes ink on top rather than cream.
    label: "Sand",
    chip: "bg-paper-300 text-ink-950",
    soft: "bg-paper-300/45 text-ink-950",
    wash: "bg-paper-300/65 text-ink-950",
    dot: "bg-paper-400",
    tokens: { fill: "paper-300", on: "ink-950", wash: "paper-300", washAlpha: 0.65, washOn: "ink-950" },
  },
};

/**
 * What the colours used to be called, pointed at what they are now.
 *
 * A category coloured `chili` two years ago must not turn black because the
 * list was rewritten. Aliases rather than a migration: the stored value is
 * the owner's, and rewriting somebody's data to suit a refactor is how a
 * template earns a reputation.
 */
const TONE_ALIASES: Record<string, string> = {
  chili: "warn",
  gold: "brand",
  jade: "ok",
  teal: "ok",
  brown: "ink",
  sand: "paper",
};

export const CATEGORY_COLOURS = Object.keys(CATEGORY_TONES);

/** The fallback is deliberately quiet: an uncoloured category is not a loud one. */
const DEFAULT_CATEGORY_TONE = "ink";

const FALLBACK_TONE: CategoryTone = CATEGORY_TONES[DEFAULT_CATEGORY_TONE]!;

export function toneFor(colour: string | null | undefined): CategoryTone {
  const key = colour ?? "";
  return CATEGORY_TONES[key] ?? CATEGORY_TONES[TONE_ALIASES[key] ?? ""] ?? FALLBACK_TONE;
}

export type MenuCategory = { name: string; colour: string; sort_order: number };

/**
 * A colour for a category nobody has coloured yet.
 *
 * Hashed from the name rather than picked at random, so it is the same colour
 * on every screen and after every reload — a category that changes colour when
 * you refresh reads as a bug, and worse, stops being a thing the eye can
 * learn. Not stored: the moment the owner picks one, that is what's stored.
 */
export function fallbackColour(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  // The modulus cannot leave the array, but the compiler does not know that
  // and an empty CATEGORY_COLOURS would make it true — so say what happens.
  return CATEGORY_COLOURS[h % CATEGORY_COLOURS.length] ?? DEFAULT_CATEGORY_TONE;
}

/**
 * The colour to paint a category, given whatever the shop has set.
 *
 * Written once here because the menu, the till, the costing screen and the
 * admin list all need the same answer, and a category that is red on one
 * screen and green on another is worse than no colour at all.
 */
export function colourOf(
  name: string,
  known: Map<string, string> | undefined
): CategoryTone {
  const stored = known?.get(name);
  return toneFor(stored ?? fallbackColour(name));
}

/** What a product's category is, with the same fallback everywhere. */
export function categoryOf(categories: string[] | null | undefined): string {
  return categories?.[0]?.trim() || "Menu";
}

/**
 * Tidy the list a product is saved with.
 *
 * Trims, drops blanks, and removes case-insensitive duplicates while keeping
 * the first spelling — so a product tagged "Chicken" and "chicken" ends up with
 * one category rather than two that look identical on the customer's filter
 * bar and behave as separate things.
 *
 * Order survives, because the first one leads: it is what the product reads as
 * anywhere there is only room for one.
 */
export function cleanCategories(input: string[] | undefined): string[] {
  const out: string[] = [];
  for (const raw of input ?? []) {
    const name = raw.trim();
    if (!name) continue;
    if (out.some((v) => v.toLowerCase() === name.toLowerCase())) continue;
    out.push(name);
  }
  return out;
}

/**
 * A product, as far as its categories are concerned.
 *
 * Every screen that groups products reads this shape and nothing more, so the
 * three rules below can be shared without any of them depending on which
 * screen is asking.
 */
export type Categorised = { categories: string[] | null | undefined };

/**
 * Is this product in that category?
 *
 * ANY of its categories, not just the first. `categoryOf` returns the first
 * one — the "main" that decides the product's colour — and using that to answer
 * this question is the bug these three functions exist to stop coming back.
 * A product tagged Mains and Ji Wings is in Ji Wings; a filter that says
 * otherwise is a pill that shows nothing.
 */
export function inCategory(item: Categorised, name: string): boolean {
  return (item.categories ?? []).some((c) => c.trim() === name);
}

/**
 * Every category actually in use, in the shop's own order first.
 *
 * The products decide WHICH categories exist; `known` — the `catalog_categories`
 * table — only decides what order they come in. That way a menu imported from
 * somewhere with no vocabulary rows still gets its filters, and a category
 * with a row but no product never becomes a pill that shows nothing.
 */
export function categoriesUsed(
  items: Categorised[],
  known: { name: string }[] = []
): string[] {
  const used = new Set<string>();
  for (const item of items) {
    for (const raw of item.categories ?? []) {
      const name = raw.trim();
      if (name) used.add(name);
    }
  }
  const ordered = known.map((c) => c.name).filter((n) => used.has(n));
  const rest = [...used].filter((n) => !ordered.includes(n)).sort();
  return [...ordered, ...rest];
}

/**
 * Where a product sits in the menu's running order.
 *
 * The EARLIEST block it belongs to, across all of its categories — not the
 * block its first category names. That distinction is what makes this
 * controllable, so it is worth saying why.
 *
 * A milktea is usually tagged "Drinks" and "Milktea"; a Coke, "Drinks" and
 * "Soft drinks". If the order put "Drinks" near the front, every drink in the
 * shop would collapse into one early block and the careful Coffee → Milktea →
 * Raspberry → Soft drinks sequence would never appear. With "Drinks" placed
 * last, the same rule reads the specific category instead, and a product tagged
 * only "Drinks" still lands at the end where it belongs.
 *
 * So the owner controls the whole layout by dragging one chip, rather than by
 * re-tagging thirty products. Anything in no known category sorts last.
 */
export function menuRank(item: Categorised, order: Map<string, number>): number {
  let best = Number.MAX_SAFE_INTEGER;
  for (const raw of item.categories ?? []) {
    const rank = order.get(raw.trim());
    if (rank !== undefined && rank < best) best = rank;
  }
  return best;
}

/**
 * The products, in the order the shop put its categories in.
 *
 * "All" used to be alphabetical by name, which is why a menu of Taiwanese
 * food opened on three two-litre bottles of soft drink: the names start with
 * digits, and digits sort before letters. Nobody chose that order — it was
 * the database's `order by name` showing through.
 *
 * Takes the ordered category list rather than the raw `catalog_categories` rows,
 * so the grid and the filter pills above it are literally reading the same
 * array. Two lists that are meant to agree and are computed separately are
 * two lists that will eventually disagree.
 *
 * Ties break on name, with numeric collation — "8oz" before "16oz" before
 * "22oz", which is the order a person reads a drinks size in and the opposite
 * of what plain string sorting gives.
 */
export function orderForMenu<T extends Categorised & { name: string }>(
  items: T[],
  categories: string[]
): T[] {
  const order = new Map(categories.map((name, i) => [name, i]));
  return [...items].sort((a, b) => {
    const rankA = menuRank(a, order);
    const rankB = menuRank(b, order);
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name, "en", { numeric: true });
  });
}

/**
 * How many products are in each category.
 *
 * A product in two categories counts in both, so these deliberately sum to more
 * than the number of products. That is the honest answer to what a chip asks —
 * "how many products are in here" — and the alternative, counting each product
 * once under its first category, is what made a category holding a product
 * display as zero.
 */
export function countByCategory(items: Categorised[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const raw of item.categories ?? []) {
      const name = raw.trim();
      if (!name) continue;
      counts[name] = (counts[name] ?? 0) + 1;
    }
  }
  return counts;
}
