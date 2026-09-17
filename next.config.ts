import type { NextConfig } from "next";
import { MAX_IMAGE_BYTES } from "./src/lib/media.ts";

/**
 * Image hosts come from the environment, never from a literal.
 *
 * The system this one is based on hard-coded one project's storage bucket
 * here, which meant a copy of the codebase silently served another shop's
 * photos — and a shop with no bucket configured got a grid of 400s from the
 * image optimiser with nothing in the logs to explain it.
 */
const storageHost = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  /*
   * How big a form post may be.
   *
   * Next defaults this to 1MB, and `media.ts` has been telling customers they
   * may send a photo of up to 5MB. Anything between the two was accepted by
   * the browser, uploaded over a phone connection, and then refused by the
   * framework before a line of our own code ran — so a GCash screenshot from
   * a modern phone could fail with an error nobody wrote and nothing in the
   * shop's logs.
   *
   * Set from the one place that decides the limit rather than typed, with
   * headroom for the rest of the payload: a customer may send several
   * reference photos with an enquiry, and they arrive in the same request.
   */
  experimental: {
    serverActions: { bodySizeLimit: MAX_IMAGE_BYTES * 3 + 1024 * 1024 },
  },
  images: {
    remotePatterns: storageHost
      ? [{ protocol: "https", hostname: storageHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
