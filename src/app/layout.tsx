import type { Metadata, Viewport } from "next";
import { brand, brandVars } from "../../config/index.ts";
import "./globals.css";

/*
 * The shop's name, description and share card come from config, so the only
 * way this file can be wrong is if the config is — which validation catches at
 * import, before a page ever renders.
 */
export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  openGraph: {
    title: brand.name,
    description: brand.description,
    siteName: brand.name,
    locale: brand.locale.replace("-", "_"),
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: brand.palette["paper-50"] },
    { media: "(prefers-color-scheme: dark)", color: brand.palette["ink-900"] },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={brand.locale}>
      <head>
        {/*
          The palette, injected ahead of the stylesheet that references it.
          It goes in the document rather than in a CSS file on purpose: this is
          per-shop data, and baking it into the bundle is what would make this
          one shop's website instead of a system any shop can run.
        */}
        <style dangerouslySetInnerHTML={{ __html: brandVars() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
