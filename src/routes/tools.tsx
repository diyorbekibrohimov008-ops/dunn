import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { changeOrderLetter } from "@/lib/letters";
import { money, moneyExact, pct } from "@/lib/format";
import { lateFee, recoveryProbability } from "@/lib/recovery";

export const Route = createFileRoute("/tools")({ component: Tools });

function Tools() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="font-serif text-4xl italic tracking-tight text-fg">Invoice calculators</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Quick free calculators for late fees, the cost of waiting, deciding between small
        claims and agencies, and pricing out-of-scope extras. Nothing leaves your browser.
      </p>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <LateFeeTool />
        <WaitCostTool />
        <ClaimsTool />
        <ChangeOrderTool />
      </div>
    </main>
  );
}

function LateFeeTool() {
  const [amount, setAmount] = useState("4200");
  const [days, setDays] = useState("47");
  const [rate, setRate] = useState("1.5");
  const n = Number(amount) || 0;
  const d = Number(days) || 0;
  const r = (Number(rate) || 0) / 100;
  const fee = lateFee(n, d, r);

  return (
    <Tool title="Late fee" lede="1.5% a month is common in US service contracts. Only charge it if it was in the terms they already accepted.">
      <div className="grid grid-cols-3 gap-3">
        <Num label="Amount" value={amount} onChange={setAmount} />
        <Num label="Days overdue" value={days} onChange={setDays} />
        <Num label="% / month" value={rate} onChange={setRate} />
      </div>
      <Result label="Fee on paper" value={moneyExact(fee)} />
    </Tool>
  );
}

function WaitCostTool() {
  const [amount, setAmount] = useState("17700");
  const [days, setDays] = useState("30");
  const n = Number(amount) || 0;
  const d = Number(days) || 0;
  const now = n * recoveryProbability(d);
  const later = n * recoveryProbability(d + 30);
  const wait = Math.max(0, now - later);

  return (
    <Tool
      title="Cost of waiting"
      lede="Recovery odds fall on a clock, not a feeling. This is the expected dollars you give up by sitting on the file for another month."
    >
      <div className="grid grid-cols-2 gap-3">
        <Num label="Amount overdue" value={amount} onChange={setAmount} />
        <Num label="Days already late" value={days} onChange={setDays} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <Mini k="Odds now" v={pct(recoveryProbability(d))} />
        <Mini k="Expected now" v={money(now)} />
        <Mini k="Lost in 30 days" v={money(wait)} warn />
      </dl>
    </Tool>
  );
}

function ClaimsTool() {
  const [amount, setAmount] = useState("4200");
  const [days, setDays] = useState("112");
  const n = Number(amount) || 0;
  const d = Number(days) || 0;
  const p = recoveryProbability(d);
  const diy = n * p;
  const agencyKeep = n * 0.33;
  const filing = n >= 5000 ? 125 : 75;
  const rec =
    d >= 90 && n >= 800
      ? "Small claims is usually cheaper than an agency, if you can spare a morning."
      : d < 30
        ? "Too early. Stay on the letter sequence."
        : n < 400
          ? "The amount is smaller than the hours. Write the demand, then decide."
          : "Send the demand letter. Revisit claims if they still ignore it.";

  return (
    <Tool title="DIY vs claims vs agency" lede="Agencies advertise recovery. They are priced for files you have already lost the will to touch.">
      <div className="grid grid-cols-2 gap-3">
        <Num label="Amount" value={amount} onChange={setAmount} />
        <Num label="Days overdue" value={days} onChange={setDays} />
      </div>
      <ul className="mt-4 space-y-2 text-sm text-muted">
        <li>DIY expected value: <span className="text-fg">{money(diy)}</span> ({pct(p)} odds)</li>
        <li>Agency cut if they collect in full: <span className="text-fg">{money(agencyKeep)}</span></li>
        <li>Typical small-claims filing + service: <span className="text-fg">{money(filing)}</span></li>
      </ul>
      <p className="mt-4 text-sm text-fg">{rec}</p>
    </Tool>
  );
}

function ChangeOrderTool() {
  const [client, setClient] = useState("Maya Ellison");
  const [you, setYou] = useState("Alex Rivera");
  const [biz, setBiz] = useState("Rivera Studio");
  const [scope, setScope] = useState("Homepage and four inner pages");
  const [orig, setOrig] = useState("4200");
  const [extra, setExtra] = useState("Two extra landing pages and a blog index");
  const [extraAmt, setExtraAmt] = useState("900");

  const letter = useMemo(
    () =>
      changeOrderLetter({
        clientName: client,
        yourName: you,
        yourBusiness: biz,
        originalScope: scope,
        originalAmount: Number(orig) || 0,
        extra,
        extraAmount: Number(extraAmt) || 0,
        currency: "USD",
      }),
    [client, you, biz, scope, orig, extra, extraAmt],
  );

  return (
    <Tool
      className="lg:col-span-2"
      title="Change order"
      lede="Fifty-seven percent of freelancers lose four figures a month to “tiny extras.” This letter prices the extra before you do it."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client" value={client} onChange={setClient} />
        <Field label="Your name" value={you} onChange={setYou} />
        <Field label="Business" value={biz} onChange={setBiz} />
        <Field label="Original scope" value={scope} onChange={setScope} />
        <Num label="Original quote" value={orig} onChange={setOrig} />
        <Num label="Extra amount" value={extraAmt} onChange={setExtraAmt} />
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="extra-work">Added work</Label>
          <Textarea id="extra-work" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </div>
      </div>
      <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-paper px-4 py-4 font-sans text-sm leading-relaxed text-ink">
        {letter.subject}

{letter.body}
      </pre>
      <Button
        className="mt-3"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`${letter.subject}\n\n${letter.body}`);
            toast.success("Change order copied");
          } catch {
            toast.error("Could not access clipboard. Select and copy the text manually.");
          }
        }}
      >
        Copy letter
      </Button>
    </Tool>
  );
}

function Tool({
  title,
  lede,
  children,
  className,
}: {
  title: string;
  lede: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-5 sm:p-6 ${className ?? ""}`}>
      <h2 className="font-serif text-2xl italic text-fg">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{lede}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `f-${label}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `n-${label}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-5 font-mono text-2xl tabular-nums text-fg">
      {value}
      <span className="ml-2 text-xs font-sans tracking-wide text-subtle uppercase">{label}</span>
    </p>
  );
}

function Mini({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-2xs text-subtle uppercase">{k}</dt>
      <dd className={`mt-1 font-mono tabular-nums ${warn ? "text-danger" : "text-fg"}`}>{v}</dd>
    </div>
  );
}
