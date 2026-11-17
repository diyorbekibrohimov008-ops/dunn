import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatterRow } from "@/components/matter-row";
import { useHasHydrated } from "@/components/hydrate";
import { money } from "@/lib/format";
import { totals } from "@/lib/recovery";
import { useDunn } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const hydrated = useHasHydrated();
  const matters = useDunn((s) => s.matters);
  const t = hydrated ? totals(matters) : null;

  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-8 sm:px-6 sm:pt-16">
        <p className="text-2xs tracking-kicker text-subtle uppercase">Overdue invoice recovery</p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.12] tracking-tight text-fg sm:text-6xl">
          You already did the work. Dunn writes the letter that gets you paid.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          Eighty-five percent of freelancers get paid late. The average small-business
          overdue stack is $17,700. Collections keeps a third. Dunn builds the
          sequence — courtesy, nudge, pause, demand — so one unpaid invoice does
          not become a write-off.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/new">
              Open a recovery file
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/file/$fileId" params={{ fileId: "sample-harper" }}>
              Try a sample file
            </Link>
          </Button>
        </div>
      </section>

      <section className="border-y border-border bg-surface/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px sm:grid-cols-4">
          <Fact k="85%" v="of freelancers are paid late, at least sometimes" />
          <Fact k="$17,700" v="average sitting unpaid at firms with 30-day overdue invoices" />
          <Fact k="50%" v="recovery odds by day 90 if you have not escalated" />
          <Fact k="25–50%" v="what an agency keeps of whatever they collect" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-serif text-3xl italic text-fg">How a file works</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          <Step n="01" t="Open the invoice" d="Amount, due date, who owes you, what you delivered. Two minutes." />
          <Step n="02" t="Read the diagnosis" d="Days overdue, recovery odds, the cost of waiting 30 more days, and the letter to send today." />
          <Step n="03" t="Send, then stop thinking" d="Connect Gmail to send automatically when ready — or copy and mark sent. Dunn handles the next date." />
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-3xl italic text-fg">On the desk</h2>
            <p className="mt-2 text-sm text-muted">
              {t
                ? `${money(t.atRisk)} open · ${money(t.expected)} expected if you act this week`
                : "Loading files…"}
            </p>
          </div>
          <Link to="/desk" className="text-sm text-primary hover:underline">
            Full desk
          </Link>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          {hydrated
            ? matters.slice(0, 3).map((m) => <MatterRow key={m.id} matter={m} />)
            : [0, 1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl border border-border bg-surface" />
              ))}
        </div>
      </section>
    </main>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="px-5 py-6 sm:px-6 sm:py-8">
      <p className="font-serif text-3xl text-fg sm:text-4xl">{k}</p>
      <p className="mt-2 text-sm leading-snug text-muted">{v}</p>
    </div>
  );
}

function Step({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      <p className="font-mono text-xs text-subtle">{n}</p>
      <h3 className="mt-3 font-serif text-2xl text-fg">{t}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
    </li>
  );
}
