"use client";

import { createContext, useContext } from "react";
import { CONFIG_ASSETS, type BrandAssets } from "@/lib/brand-assets";

/**
 * The shop's artwork, handed down from the layout.
 *
 * `Logo` is drawn inside the nav and the preloader, both of which are client
 * components and so cannot read a database themselves. The layout does it
 * once per request and passes the answer down.
 *
 * The default is the config's, so a `Logo` rendered outside this provider —
 * in a test, in an isolated preview — still draws something rather than
 * throwing on a missing context.
 */
const Ctx = createContext<BrandAssets>(CONFIG_ASSETS);

export function BrandAssetsProvider({
  assets,
  children,
}: {
  assets: BrandAssets;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={assets}>{children}</Ctx.Provider>;
}

export const useBrandAssets = () => useContext(Ctx);
