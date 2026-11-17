import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { StatusChip } from "@/components/status-chip";
import { Badge } from "@/components/ui/badge";
import { money, plural, prettyDate } from "@/lib/format";
import { diagnose, STAGES } from "@/lib/recovery";
import type { Matter } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MatterRow({ matter }: { matter: Matter }) {
  const d = diagnose(matter);
  const closed = Boolean(matter.markedPaidAt || matter.writtenOffAt);
  const stage = STAGES.find((s) => s.id === d.stage);

  return (
    <Link
      to="/file/$fileId"
      params={{ fileId: matter.id }}
      className={cn(
        "group grid grid-cols-1 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-4 transition-[background-color,border-color] duration-150 hover:border-primary/30 hover:bg-elevated sm:grid-cols-[1fr_auto_auto] sm:px-5",
        closed && "opacity-60",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-fg">
            {matter.clientCompany || matter.clientName}
          </p>
          {matter.isSample ? <span className="text-2xs uppercase tracking-wider text-subtle">Sample</span> : null}
          <StatusChip band={d.band} />
          {matter.autoSend && !matter.isSample && !closed ? (
            <Badge tone="ok">Auto-send</Badge>
          ) : null}
        </div>
        <p className="mt-1 truncate text-sm text-muted">
          {matter.invoiceNumber} · due {prettyDate(matter.dueOn)}
          {closed
            ? matter.markedPaidAt
              ? " · paid"
              : " · written off"
            : d.days >= 0
              ? ` · ${d.days} ${plural(d.days, "day")} overdue`
              : ` · due in ${Math.abs(d.days)} ${plural(Math.abs(d.days), "day")}`}
        </p>
      </div>
      <div className="flex items-baseline justify-between gap-6 sm:block sm:text-right">
        <p className="font-mono text-lg tabular-nums text-fg">{money(matter.amount, matter.currency)}</p>
        <p className="text-xs text-muted">
          {closed ? "Closed" : `Next: ${stage?.name ?? "—"}`}
        </p>
      </div>
      <ChevronRight className="hidden size-4 text-subtle transition-transform duration-150 group-hover:translate-x-0.5 sm:block" />
    </Link>
  );
}
