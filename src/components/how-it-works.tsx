import { processSteps, toneClasses, type OrderStatusRow } from "@/lib/order-statuses";

/**
 * How ordering here actually goes, drawn from the shop's own steps.
 *
 * Every other template writes this section by hand and it is wrong within a
 * month, because the words on the homepage and the steps the shop works
 * through are two separate things that drift. Here they are one thing: the
 * rows in `order_statuses`, the same rows the order board moves an order
 * along and the same `customer_note` the tracker shows once they have
 * ordered. Change a step in HQ and this page changes with it.
 *
 * It matters most for a shop that makes to order. Somebody being asked for a
 * deposit on something that does not exist yet is being asked to trust a
 * process, and the honest way to earn that is to show them the process before
 * they pay rather than after.
 *
 * Delivery-only steps are left out: this is read before there is an order, so
 * there is no fulfilment to filter by, and promising a courier to someone
 * collecting in person is worse than saying one step less.
 */
export function HowItWorks({ statuses }: { statuses: OrderStatusRow[] }) {
  const steps = processSteps(statuses);
  if (steps.length === 0) return null;

  return (
    // Separate cards rather than one block divided by hairlines: five steps
    // in a three-column block leave a sixth cell showing the divider colour,
    // which reads as a step whose text failed to load.
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((step, i) => {
        // Each step in the colour its own row carries — the same colour the
        // order board paints it, and the same one the customer will see
        // against their order once they have placed it. The shop set these
        // in HQ, so the homepage learns the palette of its own process
        // rather than being given a decorative one.
        const tone = toneClasses(step.tone);
        return (
          <li
            key={step.key}
            className={`flex flex-col gap-2 rounded-2xl border-l-4 bg-paper-100 p-6 ring-1 ring-ink-950/[0.07] ${tone.rail}`}
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-full font-mono text-xs font-black ${tone.chip}`}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-1 font-display text-xl font-black text-ink-950">
              {step.label}
            </h3>
            <p className="text-sm leading-relaxed text-ink-900/70">
              {step.customerNote}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
