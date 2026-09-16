import { brand } from "../../config/index.ts";
import { SHOP, SOCIALS, siteUrl } from "@/lib/site";
import { jsonLd } from "@/lib/json-ld";
import { getSchedule } from "@/lib/hours-server";
import { getDeliverySettings } from "@/lib/delivery-server";
import { getPublicReviews } from "@/lib/reviews-server";
import { isConfigured } from "@/lib/auth";
import { DAY_NAMES } from "@/lib/hours";
import { METHOD_LABEL, PAYMENT_METHODS } from "@/lib/payments";

/**
 * What Google needs before it will show the shop as a place rather than a page.
 *
 * A small shop's customers search for the thing and the town — and the result
 * that wins is the one showing hours, a phone number and stars. None of that
 * comes from the visible page; it comes from this block, and without it the
 * site competes as a plain blue link.
 *
 * What kind of business this is comes from the config, not from here. The type
 * decides which category the shop competes in, and every shop competes in a
 * different one.
 *
 * Every other value is read from the shop's own data, so the hours Google shows
 * are the hours the owner actually set. A schema that drifts from reality is
 * worse than none: it sends people to a closed door.
 */
export async function ShopSchema() {
  const url = siteUrl();

  const [schedule, reviews, delivery] = await Promise.all([
    getSchedule(),
    isConfigured()
      ? getPublicReviews(1)
      : Promise.resolve({ reviews: [], average: 0, count: 0 }),
    getDeliverySettings(),
  ]);

  const openingHours = schedule.configured
    ? schedule.hours
        .filter((h) => h.is_open)
        .map((h) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: `https://schema.org/${DAY_NAMES[h.weekday]}`,
          opens: h.opens,
          closes: h.closes,
        }))
    : undefined;

  const schema = {
    "@context": "https://schema.org",
    "@type": brand.schema.type,
    // A stable anchor whatever the type is, so the catalogue block can point
    // back at this one and the two read as a single business.
    "@id": `${url}/#business`,
    name: SHOP.name,
    description: SHOP.description,
    url,
    telephone: SHOP.phone,
    priceRange: SHOP.priceRange,
    ...brand.schema.extras,
    // More than one, because a place result is a picture as much as a name:
    // between them a customer sees what is sold and where.
    image: [`${url}/opengraph-image`, `${url}/hero-poster.jpg`],
    address: {
      "@type": "PostalAddress",
      streetAddress: SHOP.street,
      addressLocality: SHOP.locality,
      addressRegion: SHOP.region,
      addressCountry: SHOP.country,
    },
    // Every profile the shop actually posts from. `sameAs` is how Google
    // ties this page to those accounts; listing one of three threw away the
    // other two.
    // The Maps listing belongs in here with the social profiles: sameAs is the
    // list of other places this same business is described, and for a stall
    // the listing is the most consequential of them.
    sameAs: [...SOCIALS.map((s) => s.href), SHOP.mapUrl],

    // And again as hasMap, which is the property that means "this is the map
    // of this place" rather than merely "this is also us".
    hasMap: SHOP.mapUrl,

    // Where the stall actually is, to the metre — the same pin as the Google
    // Business Profile, so the listing and this page describe one place rather
    // than two that happen to share a name.
    //
    // The single most useful thing on this block for "near me": an address
    // string has to be geocoded and guessed at, a coordinate does not.
    // Omitted rather than guessed when no pin has been dropped. A search
    // engine then places the business from its postal address, which is at
    // least the address the shop typed; a coordinate copied from whatever
    // this config was forked from is a different building in a different
    // province, stated with total confidence.
    ...(SHOP.lat !== null && SHOP.lng !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: SHOP.lat, longitude: SHOP.lng } }
      : {}),

    // The radius the shop will actually travel, read from the settings that
    // enforce it at checkout — so what Google is told and what a customer is
    // allowed to order are the same number. Centred on the delivery origin
    // rather than on SHOP, because that is the point fees are measured from
    // and therefore the true centre of the area being described.
    ...(delivery.is_enabled
      ? {
          areaServed: {
            "@type": "GeoCircle",
            geoMidpoint: {
              "@type": "GeoCoordinates",
              latitude: delivery.shop_lat,
              longitude: delivery.shop_lng,
            },
            geoRadius: delivery.max_km * 1000,
          },
        }
      : {}),

    // Answers a question people search: "do they take GCash?". These are the
    // methods the system supports, not a fact about one shop.
    paymentAccepted: PAYMENT_METHODS.map((m) => METHOD_LABEL[m]).join(", "),
    currenciesAccepted: brand.currency.code,
    // A Restaurant has a menu; every other type has a catalogue of products.
    // Naming the wrong property does not degrade the block, it voids it.
    ...(brand.schema.catalogue === "Menu"
      ? { hasMenu: `${url}/menu` }
      : { hasOfferCatalog: { "@id": `${url}/menu#catalogue` } }),
    ...(openingHours?.length ? { openingHoursSpecification: openingHours } : {}),
    // Only claimed when it's true — a rating invented out of nothing is the
    // fastest way to have every rich result for this site suppressed.
    ...(reviews.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviews.average.toFixed(1),
            reviewCount: reviews.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    potentialAction: {
      "@type": "OrderAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/menu`,
        inLanguage: brand.locale,
        actionPlatform: [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform",
        ],
      },
      deliveryMethod: [
        "https://schema.org/OnSitePickup",
        "https://schema.org/ParcelService",
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is data, not markup, and the values are the
      // shop's own — but "</" is escaped anyway so a stray sequence in a
      // review or a closure note can't end the script tag early.
      dangerouslySetInnerHTML={{
        __html: jsonLd(schema),
      }}
    />
  );
}
