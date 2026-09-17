/**
 * What the customer sent, as something you can actually open.
 *
 * Thumbnails that link to the full file, because the detail somebody is
 * checking is usually a small one — the width of a ribbon, the spelling on
 * somebody else's sash. The links are signed and short-lived, so this is
 * rendered fresh on every request rather than stored anywhere.
 */
export function ReferenceStrip({
  links,
  className = "",
}: {
  links: string[];
  className?: string;
}) {
  if (links.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-widest text-ink-900/45">
        They sent
      </span>
      {links.map((href, i) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="block h-16 w-16 overflow-hidden rounded-lg ring-1 ring-ink-950/15 transition-transform hover:scale-105"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={href}
            alt={`What they sent, ${i + 1}`}
            className="h-full w-full object-cover"
          />
        </a>
      ))}
    </div>
  );
}
