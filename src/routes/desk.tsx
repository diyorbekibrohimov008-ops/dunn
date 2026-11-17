import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatterRow } from "@/components/matter-row";
import { useHasHydrated } from "@/components/hydrate";
import { money } from "@/lib/format";
import { openMatters, totals } from "@/lib/recovery";
import { useDunn } from "@/lib/store";

export const Route = createFileRoute("/desk")({ component: Desk });

function Desk() {
  const hydrated = useHasHydrated();
  const matters = useDunn((s) => s.matters);
  const gmailTokens = useDunn((s) => s.gmailTokens);
  const autoSendSettings = useDunn((s) => s.autoSendSettings);
  const t = hydrated ? totals(matters) : null;
  const open = hydrated ? openMatters(matters) : [];
  const closed = hydrated ? matters.filter((m) => m.markedPaidAt || m.writtenOffAt) : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-2xs tracking-kicker text-subtle uppercase">The desk</p>
          <h1 className="mt-2 font-serif text-4xl italic tracking-tight text-fg">Open files</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {t
              ? `${money(t.atRisk)} at risk across ${t.count} ${t.count === 1 ? "file" : "files"}. Waiting 30 days leaks about ${money(t.waitCost)} of expected recovery.`
              : "Loading the desk…"}
          </p>
        </div>
        <Button asChild>
          <Link to="/new">Open a file</Link>
        </Button>
      </div>

      {t ? (
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile k="Open" v={money(t.atRisk)} />
          <Tile k="Expected if you act" v={money(t.expected)} />
          <Tile k="Cost of waiting 30 days" v={money(t.waitCost)} warn />
        </dl>
      ) : (
        <div className="mt-8 h-24 rounded-xl border border-border bg-surface" />
      )}

      {hydrated ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
            <Mail className={gmailTokens ? "mt-0.5 size-4 shrink-0 text-ok sm:mt-0" : "mt-0.5 size-4 shrink-0 text-subtle sm:mt-0"} />
            <p className="text-muted">
              {gmailTokens ? (
                <>
                  Gmail connected as <span className="font-mono text-fg">{gmailTokens.email}</span>
                  {" · "}
                  {autoSendSettings.autoSendOnCreate || autoSendSettings.autoSendDueFollowups
                    ? "Auto-send active"
                    : "Manual send mode"}
                </>
              ) : (
                "Connect Gmail to email ready invoices and due follow-up letters automatically."
              )}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/settings">{gmailTokens ? "Gmail settings" : "Connect Gmail"}</Link>
          </Button>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        {hydrated && open.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="font-serif text-2xl text-fg">Nothing overdue on the desk.</p>
            <p className="mt-2 text-sm text-muted">Open a file the day you send the invoice — not the day you start worrying.</p>
          </div>
        ) : (
          (hydrated ? open : []).map((m) => <MatterRow key={m.id} matter={m} />)
        )}
      </div>

      {closed.length > 0 ? (
        <div className="mt-12">
          <h2 className="font-serif text-2xl italic text-fg">Closed</h2>
          <div className="mt-4 flex flex-col gap-3">
            {closed.map((m) => (
              <MatterRow key={m.id} matter={m} />
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Tile({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-4">
      <dt className="text-2xs tracking-wide text-subtle uppercase">{k}</dt>
      <dd className={`mt-1 font-mono text-lg tabular-nums ${warn ? "text-danger" : "text-fg"}`}>{v}</dd>
    </div>
  );
}
