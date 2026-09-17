import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getViewer } from "@/lib/auth";
import { PRIVATE_BUCKET } from "@/lib/media";

/**
 * Short links to files nobody may simply fetch.
 *
 * The private bucket holds two kinds of thing a customer sent — the
 * screenshot of a payment, and the photograph of what they want made — and
 * both are read the same way: signed per request, for somebody the server
 * has checked, and never stored.
 *
 * The check is in here rather than at the call sites. Signing needs the
 * service-role client, and a helper that mints a link to anybody's file for
 * whoever calls it is one careless import away from being a hole in a new
 * place. So it asks who is looking, every time, and a caller that forgot is
 * still safe.
 *
 * Staff, not owner. Both of these are things the person at the counter needs
 * in front of them: one to check a reference number against the GCash app,
 * the other to make the thing.
 */
export async function signPrivate(
  paths: string[],
  seconds: number
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const wanted = [...new Set(paths.filter(Boolean))];
  if (wanted.length === 0) return out;

  if (!can(await getViewer(), "orders")) return out;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return out;

  try {
    const { data, error } = await createAdminClient()
      .storage.from(PRIVATE_BUCKET)
      .createSignedUrls(wanted, seconds);
    if (error || !data) return out;

    // `createSignedUrls` answers in the order it was asked and reports a
    // per-file error rather than failing the batch — one deleted file must
    // not take the other twelve links down with it.
    data.forEach((signed, i) => {
      const asked = wanted[i];
      if (asked && signed.signedUrl && !signed.error) out.set(asked, signed.signedUrl);
    });
  } catch {
    // A page that renders without its links beats a page that does not
    // render. Both callers already draw the "nothing attached" case.
  }

  return out;
}
