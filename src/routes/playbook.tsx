import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DISCLAIMER } from "@/lib/letters";

export const Route = createFileRoute("/playbook")({ component: Playbook });

function Playbook() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="font-serif text-4xl italic tracking-tight text-fg">Late invoice guide</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Most late invoices aren't personal — they're a missed email, an unclear due date,
        or a lack of follow-up. Here's the simple step-by-step schedule that works.
      </p>

      <article className="prose-dunn mt-10 flex flex-col gap-10 text-[15px] leading-relaxed text-muted">
        <Section title="Why they pay late">
          <p>
            Studies of paid invoices keep finding the same three traits on the late
            ones: the due date was the day the invoice went out (“due on receipt”
            gives you nothing to chase against), the client never opened it, and
            nothing happened when the date passed. The typical delay is about eleven
            days. One in four late invoices is 28 days or more. After 90 days,
            recovery without a third party sits near a coin flip. After six months,
            about a quarter.
          </p>
        </Section>

        <Section title="The sequence, not a mood">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Due date or next business day — a courtesy check-in.</li>
            <li>Day 3–5 — did it land, who approves, when will it be paid.</li>
            <li>Day 7 — a new deadline and the late fee, if it was in the terms.</li>
            <li>Day 14 — last informal notice. Pause further work.</li>
            <li>Day 30 — dated demand letter. After that: claims or an agency.</li>
          </ol>
          <p className="mt-3">
            If you are already at day 47 with nothing sent, do not start at courtesy.
            It reads as optional. Open the demand.
          </p>
        </Section>

        <Section title="What not to do">
          <ul className="list-disc space-y-2 pl-5">
            <li>Do not apologize for asking to be paid.</li>
            <li>Do not wait sixty days because it feels awkward.</li>
            <li>Do not write in all caps, or invent a statute you did not look up.</li>
            <li>Do not add a late fee that was never in the contract.</li>
            <li>Do not keep working for a client who is 30 days dark on the last invoice.</li>
          </ul>
        </Section>

        <Section title="The $100 question">
          <p>
            One overdue invoice at a few thousand dollars is already a $100 problem
            — in hours, in cash-flow, in the fee an agency will take. Dunn is built
            so the next hour is a letter, not a spiral. If the amount is large and
            the file is cold, small claims is often cheaper than 33% to a collector.
            If the expected recovery is smaller than an afternoon, write it off and
            keep the demand on file.
          </p>
        </Section>

        <Section title="Scope creep sits next door">
          <p>
            Independent research keeps putting extra unpaid work in the same
            neighborhood as late payment: more than half of freelance projects grow
            without a change order. Price the extra before you do it. The change-order
            tool on this desk exists for that sentence.
          </p>
        </Section>
      </article>

      <p className="mt-10 text-xs leading-relaxed text-subtle">{DISCLAIMER}</p>
      <Button asChild className="mt-6">
        <Link to="/new">Add an invoice</Link>
      </Button>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl text-fg">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
