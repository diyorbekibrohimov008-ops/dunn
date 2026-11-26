import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, Mail, Printer, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DiagnosisPanel } from "@/components/diagnosis-panel";
import { useHasHydrated } from "@/components/hydrate";
import { LetterSheet } from "@/components/letter-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { money, moneyExact, prettyDate } from "@/lib/format";
import {
  isExampleEmail,
  isValidEmail,
  sendMatterTargetViaGmail,
  type SendTarget,
} from "@/lib/gmail-client";
import {
  buildInvoiceEmail,
  buildLetter,
  buildPhoneScript,
  DISCLAIMER,
  stageLabel,
} from "@/lib/letters";
import { diagnose, lastSentStage, lateFee, STAGES } from "@/lib/recovery";
import { useDunn } from "@/lib/store";
import type { StageId } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/file/$fileId")({ component: FilePage });

type FileTab = SendTarget | "phone" | "math";

function FilePage() {
  const { fileId } = Route.useParams();
  const hydrated = useHasHydrated();
  const navigate = useNavigate();
  const matter = useDunn((s) => s.matters.find((m) => m.id === fileId));
  const gmailTokens = useDunn((s) => s.gmailTokens);
  const markSent = useDunn((s) => s.markSent);
  const markInvoiceSent = useDunn((s) => s.markInvoiceSent);
  const markPaid = useDunn((s) => s.markPaid);
  const writeOff = useDunn((s) => s.writeOff);
  const reopen = useDunn((s) => s.reopen);
  const remove = useDunn((s) => s.remove);
  const setMatterAutoSend = useDunn((s) => s.setMatterAutoSend);
  const updateMatterClientEmail = useDunn((s) => s.updateMatterClientEmail);

  const d = matter ? diagnose(matter) : null;
  const [tab, setTab] = useState<FileTab | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentMatterId = matter?.id;
  const currentClientEmail = matter?.clientEmail ?? "";

  useEffect(() => {
    setTab(null);
    setConfirmDelete(false);
  }, [fileId]);

  useEffect(() => {
    if (currentMatterId) {
      setEmailDraft(currentClientEmail);
    }
  }, [currentMatterId, currentClientEmail]);

  const defaultTab: FileTab = d ? (d.days < 0 ? "invoice" : d.stage) : 1;
  const selectedTab: FileTab = tab ?? defaultTab;
  const activeTarget: SendTarget =
    selectedTab === "phone" || selectedTab === "math"
      ? d && d.days < 0
        ? "invoice"
        : (d?.stage ?? 1)
      : selectedTab;

  const letter = useMemo(() => {
    if (!matter) return null;
    if (activeTarget === "invoice") {
      return buildInvoiceEmail(matter);
    }
    const base = buildLetter(matter, activeTarget);
    const ai = matter.aiLetters[activeTarget];
    return ai ?? base;
  }, [matter, activeTarget]);

  if (!hydrated) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="h-40 rounded-xl border border-border bg-surface" />
      </main>
    );
  }

  if (!matter || !d || !letter) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-serif text-3xl italic text-fg">File not on the desk</h1>
        <p className="mt-2 text-sm text-muted">It may have been removed from this browser.</p>
        <Button asChild className="mt-6">
          <Link to="/desk">Back to desk</Link>
        </Button>
      </main>
    );
  }

  const phone = buildPhoneScript(matter);
  const last = lastSentStage(matter);
  const closed = Boolean(matter.markedPaidAt || matter.writtenOffAt);
  const agencyCut = matter.amount * 0.33;
  const claimsCost = matter.amount >= 5000 ? 125 : 75;
  const hasRealEmail = isValidEmail(matter.clientEmail) && !isExampleEmail(matter.clientEmail);
  const emailDirty = emailDraft.trim() !== matter.clientEmail.trim();

  function saveClientEmail() {
    if (!matter) return;
    const trimmed = emailDraft.trim();
    if (trimmed && !isValidEmail(trimmed)) {
      toast.error("Enter a valid client email address.");
      return;
    }
    updateMatterClientEmail(matter.id, trimmed);
    toast.success(trimmed ? "Client email updated" : "Client email cleared");
  }

  async function retryLastAutoError() {
    if (!matter?.lastAutoError) return;
    const key = matter.lastAutoError.key;
    const retryTarget: SendTarget =
      key === "invoice" ? "invoice" : (Number(key) as StageId);
    setRetrying(true);
    try {
      const res = await sendMatterTargetViaGmail(matter, retryTarget, "gmail");
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Sent via Gmail to ${res.to}`);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="no-print flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-2xs tracking-kicker text-subtle uppercase">
            {matter.invoiceNumber}
            {matter.isSample ? " · sample" : ""}
          </p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight text-fg">
            {matter.clientCompany || matter.clientName}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {money(matter.amount, matter.currency)} · due {prettyDate(matter.dueOn)} ·{" "}
            {matter.workDescription || "No description on file"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {closed ? (
            <Button variant="outline" onClick={() => reopen(matter.id)}>
              Reopen
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  markPaid(matter.id);
                  toast.success("Marked paid");
                }}
              >
                Mark paid
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  writeOff(matter.id);
                  toast.message("Written off — kept on file");
                }}
              >
                Write off
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
          {confirmDelete ? (
            <>
              <Button
                variant="outline"
                className="border-danger/60 text-danger hover:bg-danger/10"
                onClick={() => {
                  remove(matter.id);
                  toast.message("Invoice removed");
                  void navigate({ to: "/desk" });
                }}
              >
                Confirm delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              aria-label="Delete invoice"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-4">
          <DiagnosisPanel matter={matter} />

          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-serif text-xl italic text-fg">Follow-up emails</h2>
            <ol className="mt-4 flex flex-col gap-1">
              <li>
                <button
                  type="button"
                  onClick={() => setTab("invoice")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-150",
                    selectedTab === "invoice"
                      ? "bg-elevated text-fg"
                      : "text-muted hover:bg-elevated/60 hover:text-fg",
                  )}
                >
                  <span>
                    <span className="font-mono text-xs tabular-nums text-subtle">0</span>
                    <span className="ml-2.5">Invoice</span>
                    {d.days < 0 && !closed ? (
                      <span className="ml-2 text-xs text-primary">ready</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-subtle">
                    {matter.invoiceSentAt
                      ? matter.invoiceSentMethod === "gmail-auto"
                        ? "auto-sent"
                        : matter.invoiceSentMethod === "gmail"
                          ? "sent · Gmail"
                          : "sent"
                      : "On issue"}
                  </span>
                </button>
              </li>
              {STAGES.map((s) => {
                const sent = matter.sentLog.find((x) => x.stage === s.id);
                const isNow = s.id === d.stage && d.days >= 0 && !closed;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setTab(s.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-150",
                        selectedTab === s.id
                          ? "bg-elevated text-fg"
                          : "text-muted hover:bg-elevated/60 hover:text-fg",
                      )}
                    >
                      <span>
                        <span className="font-mono text-xs tabular-nums text-subtle">{s.id}</span>
                        <span className="ml-2.5">{s.name}</span>
                        {isNow ? <span className="ml-2 text-xs text-primary">today</span> : null}
                      </span>
                      <span className="text-xs text-subtle">
                        {sent
                          ? sent.method === "gmail-auto"
                            ? "auto-sent"
                            : sent.method === "gmail"
                              ? "sent · Gmail"
                              : "sent"
                          : s.when}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className={cn("text-muted", selectedTab === "phone" && "bg-elevated text-fg")}
                onClick={() => setTab("phone")}
              >
                Phone script
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={cn("text-muted", selectedTab === "math" && "bg-elevated text-fg")}
                onClick={() => setTab("math")}
              >
                Cost breakdown
              </Button>
            </div>
          </section>

          <section className="no-print rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-xl italic text-fg">Gmail delivery</h2>
              {gmailTokens ? (
                <Badge tone="ok">{gmailTokens.email}</Badge>
              ) : (
                <Link to="/settings" className="text-xs text-primary hover:underline">
                  Connect Gmail
                </Link>
              )}
            </div>

            <div className="mt-4 grid gap-2">
              <Label htmlFor="file-client-email">Client email</Label>
              <div className="flex gap-2">
                <Input
                  id="file-client-email"
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder="billing@client.com"
                />
                {emailDirty ? (
                  <Button type="button" variant="outline" onClick={saveClientEmail}>
                    Save
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4">
              <div className="min-w-0">
                <Label htmlFor="file-auto-send" className="text-sm font-medium text-fg">
                  Auto-send due notices
                </Label>
                <p className="mt-1 text-xs text-muted">
                  {matter.isSample
                    ? "Sample files never send automatically."
                    : hasRealEmail
                      ? "Automatically send the next notice via Gmail when due."
                      : "Add a real client email above to enable auto-send."}
                </p>
              </div>
              <Switch
                id="file-auto-send"
                checked={Boolean(matter.autoSend) && !matter.isSample}
                disabled={Boolean(matter.isSample) || !hasRealEmail || closed}
                onCheckedChange={(checked) => {
                  setMatterAutoSend(matter.id, checked);
                  toast.message(
                    checked ? "Auto-send enabled on this file" : "Auto-send paused on this file",
                  );
                }}
              />
            </div>

            {matter.lastAutoError ? (
              <div className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-fg">
                <p className="font-medium text-danger">Last auto-send failed</p>
                <p className="mt-1 text-muted">{matter.lastAutoError.message}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retrying || !gmailTokens}
                    onClick={() => void retryLastAutoError()}
                  >
                    {retrying ? <LoaderCircle className="animate-spin" /> : <Send />}
                    Retry send
                  </Button>
                  {!gmailTokens ? (
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/settings">
                        <Mail />
                        Settings
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <div>
          {selectedTab === "phone" ? (
            <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
              <h2 className="font-serif text-2xl italic text-fg">The call</h2>
              <p className="mt-2 text-sm text-muted">{phone.goal}</p>
              <blockquote className="mt-5 rounded-lg bg-paper px-5 py-4 font-serif text-lg leading-relaxed text-ink">
                {phone.script}
              </blockquote>
              <Button
                className="mt-4"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(phone.script);
                    toast.success("Script copied");
                  } catch {
                    toast.error("Could not access clipboard. Select and copy the script manually.");
                  }
                }}
              >
                Copy script
              </Button>
            </section>
          ) : selectedTab === "math" ? (
            <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
              <h2 className="font-serif text-2xl italic text-fg">The math</h2>
              <ul className="mt-5 space-y-4 text-sm">
                <Row
                  k="Do it yourself"
                  v={`Keep 100% of whatever lands. Expected value today: ${money(d.expected, matter.currency)}.`}
                />
                <Row
                  k="Agency at 33%"
                  v={`They take ${money(agencyCut, matter.currency)} even if they collect in full. Use only when the file is cold.`}
                />
                <Row
                  k="Small claims"
                  v={`Filing and service often run about ${money(claimsCost)}. Worth it when the amount is real and 90 days have passed.`}
                />
                <Row
                  k="Late fee (1.5%/mo)"
                  v={
                    last === 0 && d.days > 0
                      ? `${moneyExact(lateFee(matter.amount, d.days), matter.currency)} — only if it was in the original terms.`
                      : `${moneyExact(d.fee, matter.currency)} accrued on paper.`
                  }
                />
              </ul>
              <p className="mt-6 text-xs leading-relaxed text-subtle">{DISCLAIMER}</p>
            </section>
          ) : (
            <div>
              <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted">
                  {activeTarget === "invoice" ? "Invoice email" : stageLabel(activeTarget)}
                  {(activeTarget === "invoice" && d.days < 0) ||
                  (activeTarget === d.stage && d.days >= 0)
                    ? " · ready to send"
                    : null}
                </p>
                {!closed ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (activeTarget === "invoice") {
                        markInvoiceSent(matter.id, { method: "manual" });
                        toast.success("Marked invoice as sent");
                      } else {
                        markSent(matter.id, activeTarget, { method: "manual" });
                        toast.success(`Marked ${stageLabel(activeTarget)} as sent`);
                      }
                    }}
                  >
                    Mark sent
                  </Button>
                ) : null}
              </div>
              <LetterSheet
                matter={matter}
                target={activeTarget}
                letter={letter}
                stamp={activeTarget === 5 ? "Past due" : undefined}
              />
              <p className="no-print mt-3 text-xs text-subtle">{DISCLAIMER}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <li>
      <p className="font-medium text-fg">{k}</p>
      <p className="mt-1 text-muted">{v}</p>
    </li>
  );
}
