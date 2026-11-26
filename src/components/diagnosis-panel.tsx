import { money, pct, plural } from "@/lib/format";
import { diagnose } from "@/lib/recovery";
import type { Matter } from "@/lib/types";
import { StatusChip } from "./status-chip";

export function DiagnosisPanel({ matter }: { matter: Matter }) {
  const d = diagnose(matter);
  const daysLabel =
    d.days < 0
      ? `Due in ${Math.abs(d.days)} ${plural(Math.abs(d.days), "day")}`
      : `${d.days} ${plural(d.days, "day")} overdue`;

  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl italic text-fg">Invoice summary</h2>
        <StatusChip band={d.band} />
      </div>
      <p className="mt-2 text-sm text-muted">{d.path.why}</p>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Status" value={daysLabel} />
        <Stat label="Chance of payment" value={pct(d.probability)} />
        <Stat label="Expected if you act" value={money(d.expected, matter.currency)} />
        <Stat
          label="Cost of waiting 30d"
          value={d.waitCost30 > 0 ? money(d.waitCost30, matter.currency) : "—"}
          warn={d.waitCost30 > 0}
        />
      </dl>

      <p className="mt-5 rounded-lg bg-elevated px-4 py-3 text-sm text-fg">
        <span className="text-muted">Recommended next step: </span>
        {d.path.title}
        {d.skipCourtesy ? " Skip the gentle reminder — at this point a firmer note works better." : null}
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className={`mt-1 font-mono text-sm tabular-nums ${warn ? "text-danger" : "text-fg"}`}>
        {value}
      </dd>
    </div>
  );
}
