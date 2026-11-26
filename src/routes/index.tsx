import { createFileRoute, Link } from "@tanstack/react-router";
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
        <span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          100% Free · Saved privately in your browser
        </span>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.12] tracking-tight text-fg sm:text-6xl">
          Get unpaid invoices paid without the awkwardness.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          Enter an overdue invoice and Dunn writes the right reminder email for you — from
          a friendly check-in to a clear final notice. Copy it in one click or send directly
          through Gmail.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/new">Add an unpaid invoice</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/file/$fileId" params={{ fileId: "sample-harper" }}>
              Try a sample invoice
            </Link>
          </Button>
        </div>
      </section>

      <section className="border-y border-border bg-surface/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px sm:grid-cols-4">
          <Fact k="85%" v="of freelancers deal with late client payments" />
          <Fact k="$17,700" v="average unpaid balance at small businesses with overdue bills" />
          <Fact k="50%" v="chance of getting paid after 90 days without a follow-up" />
          <Fact k="$0" v="cost to use Dunn — no fees, no percentage cut, ever" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-serif text-3xl italic text-fg">How it works in 3 simple steps</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          <Step n="Step 1" t="Enter the invoice" d="Add the amount, due date, client name, and what you delivered. Takes under a minute." />
          <Step n="Step 2" t="Review your draft email" d="Dunn picks the right tone for how late the payment is and writes the email for you." />
          <Step n="Step 3" t="Copy or send via Gmail" d="Copy the email to your clipboard, or connect Gmail to send follow-ups directly." />
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-3xl italic text-fg">Your invoices</h2>
            <p className="mt-2 text-sm text-muted">
              {t
                ? `${money(t.atRisk)} unpaid across open invoices — click any example below to preview its emails`
                : "Loading invoices…"}
            </p>
          </div>
          <Link to="/desk" className="text-sm text-primary hover:underline">
            View all invoices
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
