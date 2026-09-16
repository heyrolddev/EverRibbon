import { createClient } from "@/lib/supabase/server";
import { getViewer, isStaff } from "@/lib/auth";
import { MenuList, type Product } from "@/components/menu-list";
import { PageHeader } from "@/components/page-header";
import { loadAvailability } from "@/lib/costing-server";
import type { MenuCategory } from "@/lib/categories";
import { MenuSchema } from "@/components/menu-schema";
import { SHOP, siteUrl } from "@/lib/site";
import type { Metadata } from "next";

async function getMenu(): Promise<{
  menu: Product[] | null;
  categories: MenuCategory[];
  configured: boolean;
}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { menu: null, categories: [], configured: false };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, description, categories, image_url")
      .eq("is_public", true)
      .eq("is_available", true)
      .order("name");

    if (error) throw error;

    // Ratings come from their own view; a menu with no reviews yet simply
    // renders without stars rather than failing.
    const { data: ratings } = await supabase
      .from("meal_ratings")
      .select("product_id, avg_rating, review_count");

    const byMeal = new Map(
      ((ratings ?? []) as { product_id: string; avg_rating: number; review_count: number }[]).map(
        (r) => [r.product_id, r]
      )
    );

    // How many the shelf can still make. Derived, never written back to
    // `is_available` — that switch is the owner's own "we've 86'd it today",
    // and a background process overwriting it would destroy an intent the
    // system can't tell apart from its own guess.
    const makeable = await loadAvailability();

    // The shop's categories and their colours. A failure here is not a reason
    // to fail the menu: `colourOf` works out a stable colour from the name
    // when there's no row, so the worst case is the owner's chosen colours
    // being replaced by sensible ones rather than a page that won't load.
    const { data: catRows } = await supabase
      .from("catalog_categories")
      .select("name, colour, sort_order")
      .order("sort_order")
      .order("name");

    const menu = (data as Product[]).map((m) => ({
      ...m,
      avg_rating: byMeal.get(m.id) ? Number(byMeal.get(m.id)!.avg_rating) : null,
      review_count: byMeal.get(m.id)?.review_count ?? 0,
      makeable: makeable.get(m.id) ?? null,
    }));

    return { menu, categories: (catRows ?? []) as MenuCategory[], configured: true };
  } catch (err) {
    console.error("Failed to load menu:", err);
    return { menu: null, categories: [], configured: true };
  }
}

/**
 * The page a customer lands on from a search, and until now the only public
 * page with no title of its own — it inherited the site default, so a result
 * for the menu looked identical to a result for the homepage.
 *
 * The description names the products and the town, because that is what the
 * search actually was. Nobody types the name of the page; they type the thing
 * they want and where they are.
 */
export const metadata: Metadata = {
  title: SHOP.copy.catalogue,
  description: `The full ${SHOP.name} ${SHOP.copy.catalogue.toLowerCase()} — ${SHOP.copy.catalogueBlurb}, made in ${SHOP.locality}, ${SHOP.region}. Order ahead for pickup or delivery.`,
  alternates: { canonical: `${siteUrl()}/menu` },
  openGraph: {
    title: `${SHOP.copy.catalogue} · ${SHOP.name}`,
    description: `${SHOP.copy.catalogueBlurb} in ${SHOP.locality}. Order ahead for pickup or delivery.`,
    url: `${siteUrl()}/menu`,
    type: "website",
  },
};

const emptyStateClass =
  "rounded-3xl border-2 border-dashed border-brand-300 bg-paper-100 p-8 text-center text-ink-900/80";

export default async function MenuPage() {
  const [{ menu, categories, configured }, viewer] = await Promise.all([
    getMenu(),
    getViewer(),
  ]);
  const staff = isStaff(viewer);

  return (
    <main className="flex-1">
      {/* Compact, and with no scrolling banner under it. Both were earning
          their keep on the homepage, where the job is to get someone
          interested. Here they already are — they opened the catalogue — and
          every pixel above the first photograph is a pixel of the thing they
          came to look at. */}
      <PageHeader
        compact
        eyebrow={SHOP.copy.badge}
        title={SHOP.copy.catalogue}
        // The shop's own words for what it sells, then how it sells it. The
        // second half is the fulfillment mode and nothing else, so it does
        // not need a sentence in the config to say it twice.
        subtitle={`${SHOP.copy.catalogueBlurb.replace(/^./, (c) => c.toUpperCase())} — ${
          SHOP.fulfillment === "made_to_order"
            ? "ordered ahead, then built for you"
            : "ordered ahead for pickup or delivery"
        }.`}
      />

      <section className="mx-auto max-w-6xl px-6 pb-14 pt-6">
        {!configured && (
          <p className={emptyStateClass}>
            {SHOP.copy.catalogue} setup in progress — connect Supabase (see{" "}
            <code>.env.example</code>) to show live items here.
          </p>
        )}
        {configured && (!menu || menu.length === 0) && (
          <p className={emptyStateClass}>
            Nothing here yet — add products in Supabase to have them show up
            on this page.
          </p>
        )}
        {configured && menu && menu.length > 0 && (
          <>
            <MenuSchema products={menu} categories={categories} />
            <MenuList products={menu} staff={staff} known={categories} />
          </>
        )}
      </section>
    </main>
  );
}
