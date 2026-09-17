import "server-only";
import { signPrivate } from "@/lib/private-files-server";
import { REFERENCE_LINK_SECONDS, referencePaths } from "@/lib/references";

/**
 * Links to what a customer sent as an example of what they want.
 *
 * Returns one list per order and drops anything that would not sign — a file
 * deleted from the bucket shows as one photograph fewer rather than as a
 * broken frame, which on an order card reads as something the shop lost.
 */
export async function signReferences(
  rows: { id: string; reference_paths?: unknown }[]
): Promise<Map<string, string[]>> {
  const byOrder = new Map<string, string[]>();
  for (const row of rows) {
    const paths = referencePaths(row.reference_paths);
    if (paths.length > 0) byOrder.set(row.id, paths);
  }
  if (byOrder.size === 0) return new Map();

  const links = await signPrivate(
    [...byOrder.values()].flat(),
    REFERENCE_LINK_SECONDS
  );

  const out = new Map<string, string[]>();
  for (const [id, paths] of byOrder) {
    const signed = paths.map((p) => links.get(p)).filter((u): u is string => Boolean(u));
    if (signed.length > 0) out.set(id, signed);
  }
  return out;
}
