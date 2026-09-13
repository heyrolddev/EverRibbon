import type { NextConfig } from "next";

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
  images: {
    remotePatterns: storageHost
      ? [{ protocol: "https", hostname: storageHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
