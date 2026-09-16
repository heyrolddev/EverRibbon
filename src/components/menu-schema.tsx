import { brand } from "../../config/index.ts";
import { SHOP, siteUrl } from "@/lib/site";
import { jsonLd } from "@/lib/json-ld";
import type { Product } from "@/components/menu-list";

/**
 * The menu, in the form a search engine can actually read.
 *
 * `ShopSchema` already tells Google there is a business here and links to
 * the catalogue — but a link is all it is. Google knows a catalogue exists;
 * it does not know what is in it or what any of it costs. That is the
 * difference between ranking for the shop's trade and ranking for the exact
 * product, which is the search with the customer already decided.
 *
 * Every value comes from the same rows the page renders. There is no second
 * list to keep in step: if a product is renamed or repriced in HQ, this changes
 * with it. A schema that says ₱149 over a page that says ₱169 is not a small
 * inconsistency — Google treats a price mismatch as a reason to distrust the
 * whole block, and the rich result disappears with no message to say why.
 */
export function MenuSchema({
  products,
  categories,
}: {
  products: Product[];
  categories: { name: string }[];
}) {
  if (!products.length) return null;

  const url = siteUrl();

  // Grouped by the same categories the page shows, because a menu Google reads
  // as one flat list of nineteen things is a menu it cannot summarise. Products
  // whose category no longer exists still belong somewhere, so they fall into
  // a final section rather than vanishing from the markup.
  const named = categories
    .map((c) => ({
      name: c.name,
      items: products.filter((m) => m.categories?.[0] === c.name),
    }))
    .filter((s) => s.items.length > 0);

  const placed = new Set(named.flatMap((s) => s.items.map((m) => m.id)));
  const rest = products.filter((m) => !placed.has(m.id));
  const sections = rest.length ? [...named, { name: "More", items: rest }] : named;

  // One item, described once, in whichever vocabulary this shop's type takes.
  const item = (product: (typeof products)[number]) => ({
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.image_url ? { image: product.image_url } : {}),
    offers: {
      "@type": "Offer",
      price: product.price.toFixed(2),
      priceCurrency: brand.currency.code,
      availability: "https://schema.org/InStock",
    },
    // Only claimed where real ratings exist. An invented rating is the fastest
    // way to have every rich result for this site suppressed, and the
    // suppression is site-wide, not just for the product that lied.
    ...(product.review_count && product.avg_rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.avg_rating.toFixed(1),
            reviewCount: product.review_count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  });

  const food = brand.schema.catalogue === "Menu";

  const schema = {
    "@context": "https://schema.org",
    "@type": brand.schema.catalogue,
    "@id": `${url}/menu#catalogue`,
    name: `${SHOP.name} ${SHOP.copy.catalogue.toLowerCase()}`,
    url: `${url}/menu`,
    inLanguage: brand.locale,
    // Ties the catalogue back to the business block on the homepage, so the
    // two are read as one business rather than two unrelated things.
    isPartOf: { "@id": `${url}/#business` },

    // Same data, two vocabularies. A Menu holds MenuSections of MenuItems; an
    // OfferCatalog holds ItemLists of Products. Google reads one or the other
    // depending on what the business is, and a Menu published by anything that
    // is not a food business is not read loosely — it is dropped.
    ...(food
      ? {
          hasMenuSection: sections.map((section) => ({
            "@type": "MenuSection",
            name: section.name,
            hasMenuItem: section.items.map((product) => ({
              "@type": "MenuItem",
              ...item(product),
            })),
          })),
        }
      : {
          itemListElement: sections.map((section, i) => ({
            "@type": "ItemList",
            name: section.name,
            position: i + 1,
            itemListElement: section.items.map((product, j) => ({
              "@type": "ListItem",
              position: j + 1,
              item: { "@type": "Product", ...item(product) },
            })),
          })),
        }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: jsonLd(schema),
      }}
    />
  );
}
