import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, Mail, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useHasHydrated } from "@/components/hydrate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { addDaysISO, daysBetween, todayISO } from "@/lib/format";
import {
  describeTarget,
  isExampleEmail,
  isValidEmail,
  sendMatterTargetViaGmail,
  type SendTarget,
} from "@/lib/gmail-client";
import { stageLabel } from "@/lib/letters";
import { calendarStage } from "@/lib/recovery";
import { useDunn } from "@/lib/store";
import type { Currency, Matter, Relationship } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/new")({ component: NewFile });

const REL: { id: Relationship; label: string; hint: string }[] = [
  { id: "friendly", label: "Friendly", hint: "You’d still grab coffee" },
  { id: "neutral", label: "Neutral", hint: "Professional, not close" },
  { id: "strained", label: "Strained", hint: "Skip the small talk" },
];

const TERMS = [
  { id: "receipt", label: "Due on receipt", days: 0 },
  { id: "n15", label: "Net 15", days: 15 },
  { id: "n30", label: "Net 30", days: 30 },
] as const;

function NewFile() {
  const navigate = useNavigate();
  const hydrated = useHasHydrated();
  const profile = useDunn((s) => s.profile);
  const gmailTokens = useDunn((s) => s.gmailTokens);
  const autoSendSettings = useDunn((s) => s.autoSendSettings);
  const setProfile = useDunn((s) => s.setProfile);
  const upsert = useDunn((s) => s.upsert);

  const [yourName, setYourName] = useState(profile.name);
  const [yourBusiness, setYourBusiness] = useState(profile.business);
  const [yourEmail, setYourEmail] = useState(profile.email);
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(() => defaultInv());
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [issuedOn, setIssuedOn] = useState(todayISO());
  const [dueOn, setDueOn] = useState(addDaysISO(todayISO(), -14));
  const [work, setWork] = useState("");
  const [termsNote, setTermsNote] = useState("Net 30.");
  const [rel, setRel] = useState<Relationship>("neutral");

  const [autoSendNow, setAutoSendNow] = useState(autoSendSettings.autoSendOnCreate);
  const [autoFollowups, setAutoFollowups] = useState(autoSendSettings.autoSendDueFollowups);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    setYourName((cur) => cur || profile.name);
    setYourBusiness((cur) => cur || profile.business);
    setYourEmail((cur) => cur || profile.email || gmailTokens?.email || "");
    setAutoSendNow(autoSendSettings.autoSendOnCreate);
    setAutoFollowups(autoSendSettings.autoSendDueFollowups);
  }, [
    hydrated,
    profile.name,
    profile.business,
    profile.email,
    gmailTokens?.email,
    autoSendSettings.autoSendOnCreate,
    autoSendSettings.autoSendDueFollowups,
  ]);

  function applyTerms(days: number) {
    setDueOn(addDaysISO(issuedOn, days));
  }

  const days = daysBetween(dueOn, todayISO());
  const readyTarget: SendTarget = days < 0 ? "invoice" : calendarStage(Math.max(0, days));
  const readyLabel =
    readyTarget === "invoice" ? "Invoice email" : `${stageLabel(readyTarget)} notice`;

  const clientEmailValid = isValidEmail(clientEmail) && !isExampleEmail(clientEmail);
  const canAutoSend = Boolean(gmailTokens && autoSendNow && clientEmailValid);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const n = Number(amount);
    if (!clientName.trim()) {
      toast.error("Add the client’s name.");
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Amount has to be a real number.");
      return;
    }
    if (clientEmail.trim() && !isValidEmail(clientEmail)) {
      toast.error("Client email does not look valid.");
      return;
    }

    setSubmitting(true);
    try {
      const matter: Matter = {
        id: crypto.randomUUID(),
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientCompany: clientCompany.trim(),
        amount: Math.round(n * 100) / 100,
        currency,
        invoiceNumber: invoiceNumber.trim() || defaultInv(),
        issuedOn,
        dueOn,
        workDescription: work.trim(),
        relationship: rel,
        yourName: yourName.trim() || "Your name",
        yourBusiness: yourBusiness.trim(),
        yourEmail: yourEmail.trim() || gmailTokens?.email || "",
        termsNote: termsNote.trim(),
        createdAt: new Date().toISOString(),
        sentLog: [],
        aiLetters: {},
        autoSend: Boolean(gmailTokens && autoFollowups && clientEmailValid),
      };
      setProfile({
        name: matter.yourName,
        business: matter.yourBusiness,
        email: matter.yourEmail,
      });
      upsert(matter);

      if (canAutoSend) {
        const res = await sendMatterTargetViaGmail(matter, readyTarget, "gmail-auto");
        if (res.ok) {
          toast.success(`File opened & ${describeTarget(readyTarget)} sent to ${res.to}`);
        } else {
          toast.error(`File opened, but Gmail send failed: ${res.error}`);
        }
      } else {
        toast.success("File opened");
      }

      void navigate({ to: "/file/$fileId", params: { fileId: matter.id } });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <p className="text-2xs tracking-kicker text-subtle uppercase">New recovery file</p>
      <h1 className="mt-2 font-serif text-4xl italic tracking-tight text-fg">Open a file</h1>
      <p className="mt-2 text-sm text-muted">
        Put the invoice on the desk. Dunn diagnoses it, prepares the notice, and sends via
        Gmail if connected.
      </p>

      <form onSubmit={(e) => void submit(e)} className="mt-10 flex flex-col gap-10">
        <fieldset className="grid gap-4">
          <legend className="font-serif text-2xl text-fg">You</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" value={yourName} onChange={setYourName} autoComplete="name" />
            <Field label="Business" value={yourBusiness} onChange={setYourBusiness} />
            <Field
              label="Email"
              value={yourEmail}
              onChange={setYourEmail}
              type="email"
              className="sm:col-span-2"
            />
          </div>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="font-serif text-2xl text-fg">Who owes you</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client name" value={clientName} onChange={setClientName} required />
            <Field label="Company" value={clientCompany} onChange={setClientCompany} />
            <Field
              label="Client email"
              value={clientEmail}
              onChange={setClientEmail}
              type="email"
              placeholder="billing@client.com"
              className="sm:col-span-2"
            />
          </div>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="font-serif text-2xl text-fg">The invoice</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Invoice number"
              value={invoiceNumber}
              onChange={setInvoiceNumber}
              className="font-mono"
            />
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <Field
                label="Amount"
                value={amount}
                onChange={setAmount}
                inputMode="decimal"
                placeholder="4200"
              />
              <div className="grid gap-1.5">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="h-11 rounded-md border border-border bg-elevated px-2 text-sm text-fg"
                >
                  {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="issued">Issued</Label>
              <Input
                id="issued"
                type="date"
                value={issuedOn}
                onChange={(e) => setIssuedOn(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="due">Due</Label>
              <Input
                id="due"
                type="date"
                value={dueOn}
                onChange={(e) => setDueOn(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {TERMS.map((t) => (
              <Button
                key={t.id}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyTerms(t.days)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="work">What you delivered</Label>
            <Textarea
              id="work"
              value={work}
              onChange={(e) => setWork(e.target.value)}
              placeholder="Homepage redesign, four inner pages, CMS training"
            />
          </div>
          <Field
            label="Payment terms (as written)"
            value={termsNote}
            onChange={setTermsNote}
            placeholder="Net 30. Late fee 1.5% per month."
          />
        </fieldset>

        <fieldset>
          <legend className="font-serif text-2xl text-fg">The relationship</legend>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {REL.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRel(r.id)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors duration-150",
                  rel === r.id
                    ? "border-primary bg-elevated"
                    : "border-border bg-surface hover:bg-elevated",
                )}
              >
                <p className="text-sm font-medium text-fg">{r.label}</p>
                <p className="mt-1 text-xs text-muted">{r.hint}</p>
              </button>
            ))}
          </div>
        </fieldset>

        <section className="rounded-xl border border-border bg-surface p-5">
          {hydrated && gmailTokens ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif text-2xl italic text-fg">Gmail dispatch</h2>
                  <Badge tone="ok">{gmailTokens.email}</Badge>
                </div>
                <Link to="/settings" className="text-xs text-muted hover:text-fg hover:underline">
                  Settings
                </Link>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Label htmlFor="new-auto-send-now" className="text-sm font-medium text-fg">
                    Send {readyLabel} automatically when ready
                  </Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {!clientEmail.trim()
                      ? "Add the client email above so Dunn can email it automatically when you open this file."
                      : !isValidEmail(clientEmail)
                        ? "Enter a valid client email above to send automatically."
                        : isExampleEmail(clientEmail)
                          ? "Placeholder .example addresses are never emailed automatically."
                          : `Will send immediately to ${clientEmail.trim()} from ${gmailTokens.email}.`}
                  </p>
                </div>
                <Switch
                  id="new-auto-send-now"
                  checked={autoSendNow}
                  onCheckedChange={setAutoSendNow}
                />
              </div>

              <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
                <div className="min-w-0">
                  <Label htmlFor="new-auto-followups" className="text-sm font-medium text-fg">
                    Auto-send overdue follow-ups
                  </Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Automatically advance and email future stages when due while Dunn is open.
                  </p>
                </div>
                <Switch
                  id="new-auto-followups"
                  checked={autoFollowups}
                  onCheckedChange={setAutoFollowups}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-serif text-xl italic text-fg">Automatic Gmail sending</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Connect your Gmail once to email invoices and overdue notices automatically
                  when ready instead of copying manually.
                </p>
              </div>
              <Button asChild type="button" variant="outline" size="sm">
                <Link to="/settings">
                  <Mail />
                  Connect Gmail
                </Link>
              </Button>
            </div>
          )}
        </section>

        <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? <LoaderCircle className="animate-spin" /> : canAutoSend ? <Send /> : null}
          {submitting
            ? "Sending via Gmail…"
            : canAutoSend
              ? "Build file & send via Gmail"
              : "Build the recovery file"}
        </Button>
      </form>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  className,
  placeholder,
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "decimal" | "email" | "text";
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function defaultInv() {
  const d = new Date();
  const n = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `INV-${n}`;
}
