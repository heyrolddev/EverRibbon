import { SOCIALS } from "@/lib/site";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/icons";

/** Name -> mark. Keyed by name so `SOCIALS` stays plain data. */
const MARKS = {
  Facebook: FacebookIcon,
  Instagram: InstagramIcon,
  TikTok: TikTokIcon,
} as const;

/**
 * The shop's accounts, as marks.
 *
 * One component for the footer and the homepage's Visit block, because two
 * copies means the day a fourth account is added only one of them gets it —
 * and the one that doesn't is always the one the customer was looking at.
 *
 * Two tones because the two homes are opposite: the footer is cream-on-dark,
 * the Visit block dark-on-cream. Both land on gold when hovered, which is what
 * every other interactive thing on this site does.
 */
export function SocialLinks({
  tone = "dark",
  className = "",
}: {
  /** "dark" for a dark background, "light" for a cream one. */
  tone?: "dark" | "light";
  className?: string;
}) {
  const style =
    tone === "dark"
      ? "bg-paper-50/10 text-paper-100 ring-paper-50/15 hover:bg-accent-200 hover:text-ink-950"
      : "bg-ink-950/5 text-ink-950 ring-ink-950/15 hover:bg-accent-200 hover:text-ink-950";

  return (
    <ul className={`flex items-center gap-2 ${className}`}>
      {SOCIALS.map((social) => {
        // A shop may list a network this build has no mark for, so the name
        // has to work as a fallback rather than render nothing at all.
        const Mark = (MARKS as Record<string, ((p: { className?: string }) => React.ReactElement) | undefined>)[social.name];
        return (
          <li key={social.name}>
            <a
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              title={`${social.name} — ${social.handle}`}
              className={`grid h-11 w-11 place-items-center rounded-full ring-1 transition-colors ${style}`}
            >
              {Mark ? (
                <Mark className="h-5 w-5" />
              ) : (
                <span aria-hidden className="text-xs font-semibold">
                  {social.name.slice(0, 2)}
                </span>
              )}
              <span className="sr-only">
                {social.name} — {social.handle}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
