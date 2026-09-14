"use client";
import { money } from "@/lib/format";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useCart } from "@/lib/cart-context";
import { Stars } from "@/components/stars";
import { LOW_STOCK_SERVINGS } from "@/lib/costing";
import {
  categoriesUsed,
  colourOf,
  inCategory,
  orderForMenu,
  type MenuCategory,
} from "@/lib/categories";

export type Product = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  /** Servings the shelf can still make. Null when there's no recipe to go on. */
  makeable?: number | null;
  categories: string[];
  image_url: string | null;
  avg_rating?: number | null;
  review_count?: number;
};

function initialOf(name: string) {
  return (name.match(/[a-zA-Z0-9]/)?.[0] ?? name.charAt(0)).toUpperCase();
}

function MealCard({
  product,
  index,
  staff,
}: {
  product: Product;
  index: number;
  staff: boolean;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  // Derived on every render from the stock the page was built with, so a
  // product that ran out mid-session goes grey on the next load rather than
  // waiting for someone to flip a switch.
  const soldOut = product.makeable !== null && product.makeable !== undefined && product.makeable <= 0;
  const low =
    product.makeable !== null &&
    product.makeable !== undefined &&
    product.makeable > 0 &&
    product.makeable <= LOW_STOCK_SERVINGS;

  function handleAdd() {
    if (soldOut) return;
    addItem({ productId: product.id, name: product.name, price: Number(product.price) });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
      whileHover={{ y: -6 }}
      // `relative` matters: the sold-out badge is absolutely positioned, and
      // without a positioned ancestor it escapes to the top-left of the page
      // — which it did, landing on the logo. It only looked right on some
      // cards because framer-motion's transform creates a containing block
      // while the entrance animation runs, and drops it when the animation
      // settles.
      className="group relative flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-ink-950/[0.08] transition-shadow hover:shadow-xl hover:shadow-ink-950/10"
    >
      {/* Square, to match how the food is actually photographed: a round product
          shot from above fills a square and gets trimmed by anything else. The
          card was 4:3, which cut the top and bottom off every photo. */}
      {soldOut && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-ink-950 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-paper-50">
          Sold out
        </span>
      )}
      {!soldOut && low && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-accent-200 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-ink-950">
          Only {product.makeable} left
        </span>
      )}

      {/* White, and so is the card. A photo set to `object-cover` fills its
          square exactly, so recolouring only the space *behind* it would have
          changed nothing visible — what actually reads as the picture's
          background is the card around it, which was warm cream sitting on a
          red-orange wash. White lets the food carry the colour instead. */}
      <div
        className={`relative aspect-square w-full overflow-hidden bg-white ${
          soldOut ? "opacity-45 saturate-50" : ""
        }`}
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            // Cards are smaller on a laptop now, so the browser can be asked
            // for less: a stale `sizes` downloads a 360px image for a 220px
            // slot on every card of a 73-product menu.
            sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          // A product with no photo yet. Quiet rather than the old saturated
          // gradient: it's a gap, not a feature, and seventy-three of them
          // was a wall of orange with the actual food nowhere in it.
          <span className="absolute inset-0 grid place-items-center bg-paper-100 font-display text-5xl font-black text-ink-950/15">
            {initialOf(product.name)}
          </span>
        )}
      </div>

      {/* Tighter on a phone. Two columns leaves about 160px of card, and at the
          old size one product ran most of the screen — you scrolled a menu of 73
          items four at a time. The desktop sizes are unchanged. */}
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-4">
        <p className="line-clamp-2 font-display text-sm font-bold leading-tight text-ink-950 sm:text-base">
          {product.name}
        </p>
        {product.avg_rating != null && (product.review_count ?? 0) > 0 && (
          <span className="flex items-center gap-1.5">
            <Stars rating={product.avg_rating} />
            <span className="text-[11px] font-semibold text-ink-900/55 sm:text-xs">
              {product.avg_rating.toFixed(1)} ({product.review_count})
            </span>
          </span>
        )}
        {/* Shown at every size now. A name alone tells a first-time customer
            nothing about what "Ji Pai" or "XLB" actually is, which is the one
            thing a menu has to do. Clamped to two lines so a long description
            can't push the price off the bottom of the card. */}
        {product.description && (
          <p className="line-clamp-2 text-xs leading-snug text-ink-900/70 sm:text-[13px]">
            {product.description}
          </p>
        )}
        {/* Wraps rather than squeezing. Two columns on a phone leaves about
            120px of card, and a peso price beside a button doesn't fit that —
            they were overlapping, with the button sitting on the price. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-1.5 pt-2 sm:gap-2 sm:pt-3">
          <span className="font-display text-base font-black text-brand-700 sm:text-lg">
            {money(Number(product.price))}
          </span>
          {/* Nothing to add to: staff can't check out, so the button would
              only fill a cart that leads to a refusal. */}
          {!staff && (
            <button
              onClick={handleAdd}
              disabled={soldOut}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-all sm:px-4 sm:py-2 sm:text-sm ${
                soldOut
                  ? "cursor-not-allowed bg-ink-950/10 text-ink-900/40"
                  : added
                    ? "bg-ok-600 text-paper-50"
                    : "bg-ink-950 text-paper-50 hover:bg-brand-700"
              }`}
            >
              {soldOut ? "Sold out" : added ? "Added ✓" : "Add +"}
            </button>
          )}
        </div>
      </div>
    </motion.li>
  );
}

export function MenuList({
  products,
  staff = false,
  known = [],
}: {
  products: Product[];
  staff?: boolean;
  /** The shop's categories and their colours. Empty is fine — see `colourOf`. */
  known?: MenuCategory[];
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const colours = useMemo(
    () => new Map(known.map((c) => [c.name, c.colour])),
    [known]
  );

  // The products decide which pills exist; `known` only decides their order.
  // See `categoriesUsed` — this was written inline here first, which is
  // exactly why the same bug survived in two other screens.
  const order = useMemo(() => categoriesUsed(products, known), [products, known]);
  const categories = useMemo(() => ["All", ...order], [order]);

  // The same array that draws the pills also decides what leads the grid.
  //
  // Before this, "All" was whatever order the database handed back — `order
  // by name` — so a menu of Taiwanese street food opened on 1.5 Coke, 1.5
  // Sprite and a milktea, because those names start with digits. The food was
  // three rows down. The pills said one thing about what this shop sells and
  // the first screenful said another.
  const sorted = useMemo(() => orderForMenu(products, order), [products, order]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((m) => {
      const matchesCategory =
        activeCategory === "All" || inCategory(m, activeCategory);
      const matchesQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [sorted, query, activeCategory]);

  return (
    <div className="flex flex-col gap-6">
      {/* The search box and the filters sit on one line from small screens up,
          rather than stacking. This bar is pinned under the header for the
          whole page, so every row it takes is a row of food nobody can see —
          and it stays that way the entire time they scroll. */}
      <div className="sticky top-[var(--nav-h)] z-30 -mx-6 border-b border-ink-950/10 bg-paper-50 px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the menu…"
              className="w-full min-w-0 rounded-full border-2 border-ink-950/15 bg-paper-100 px-4 py-2 text-sm font-medium text-ink-950 outline-none transition-colors placeholder:text-ink-900/40 focus:border-brand-700 sm:w-52"
            />
            <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-ink-900/50">
              {filtered.length} item{filtered.length === 1 ? "" : "s"}
            </span>
          </div>

          {categories.length > 2 && (
            <div className="flex flex-wrap gap-1">
              {categories.map((category) => {
                const active = activeCategory === category;
                // "All" keeps the brand red it always had — it isn't a
                // category and shouldn't borrow one's colour. Everything else
                // is painted in its own, which is the whole point: the eye
                // learns where Drinks is and stops reading the words.
                const tone = colourOf(category, colours);
                const dot = category === "All" ? "bg-brand-700" : tone.dot;
                return (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`relative rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${
                      active
                        ? category === "All"
                          ? "text-paper-50"
                          : tone.chip
                        : "text-ink-900 hover:text-brand-700"
                    }`}
                  >
                    {active && category === "All" && (
                      <motion.span
                        layoutId="menu-filter-pill"
                        className="absolute inset-0 rounded-full bg-brand-700"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {!active && category !== "All" && (
                        <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
                      )}
                      {category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Two on a phone, three on a tablet, four from a laptop up — and four
          is the ceiling now. Five fitted, in the sense that the boxes did not
          overlap: in a 1152px container it left each card about 210px, which
          is not enough for "16oz Brown Sugar Milktea" and not enough for the
          photograph above it, so a menu of pictures became a menu of wrapped
          captions. Four gives roughly 270px. The gap opens with the cards
          rather than staying tight, or the extra width reads as drift. */}
      {filtered.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-brand-300 bg-paper-100 p-8 text-center text-ink-900/80">
          No items match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          <AnimatePresence mode="popLayout">
            {filtered.map((product, i) => (
              <MealCard key={product.id} product={product} index={i} staff={staff} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
