import { NotAllowed } from "@/components/not-allowed";
import { can, getViewer } from "@/lib/auth";
import { getBrandAssets } from "@/lib/brand-assets-server";
import { WordmarkField } from "@/components/wordmark-field";
import { hqTitle } from "@/lib/hq-theme";
import { brand } from "../../../../config/index.ts";

/**
 * The shop's own artwork.
 *
 * A logo arrives after the site is up, and it gets redrawn. Keeping it in the
 * repository meant the person who has the file had to ask the person who has
 * the code — which is how a shop runs for three months with its name set in a
 * fallback face.
 */
export default async function AdminBrandPage() {
  const viewer = await getViewer();
  if (!can(viewer, "settings")) {
    return (
      <NotAllowed>
        The shop&apos;s logo is the owner&apos;s to set. Everything drawn from
        it — the header, the footer, the share card — changes at once.
      </NotAllowed>
    );
  }

  const assets = await getBrandAssets();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className={hqTitle}>Logo</h2>
        <p className="mt-2 max-w-[62ch] text-sm text-ink-900/70">
          Used in the header, the footer and the loading screen. Upload a
          trimmed PNG with a transparent background — whatever space is left
          around the artwork becomes space around it on the page.
        </p>
      </div>

      <WordmarkField
        ground="light"
        preview="light"
        title="On light"
        blurb="The header once you scroll, and anything printed. This one has to be readable on cream, which usually means the dark version of your mark."
        initial={assets.light}
      />

      <WordmarkField
        ground="dark"
        preview="dark"
        title="On dark"
        blurb="The footer, the loading screen, and the header while it sits over the hero. Leave it empty to use the light one everywhere — worth uploading only if your mark needs a different colour to stay readable on black."
        initial={assets.dark}
      />

      <p className="max-w-[62ch] text-sm text-ink-900/60">
        {brand.name} measures{" "}
        <strong className="text-ink-950">
          {brand.palette["brand-400"]}
        </strong>{" "}
        against{" "}
        <strong className="text-ink-950">{brand.palette["paper-50"]}</strong> at
        about 2.3 to 1, which is below the 4.5 a person needs to read
        comfortably. That is why there are two slots rather than one: a metallic
        mark that looks right on black is genuinely hard to read on cream, and
        no single file fixes that.
      </p>
    </div>
  );
}
