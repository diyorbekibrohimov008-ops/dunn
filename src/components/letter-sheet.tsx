import { Link } from "@tanstack/react-router";
import { Check, Copy, LoaderCircle, Mail, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { prettyDate } from "@/lib/format";
import {
  isValidEmail,
  sendMatterTargetViaGmail,
  type SendTarget,
} from "@/lib/gmail-client";
import { rewriteLetter } from "@/lib/rewrite";
import { useDunn } from "@/lib/store";
import type { Letter, Matter } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LetterSheet({
  matter,
  target,
  letter,
  stamp,
  className,
}: {
  matter: Matter;
  target: SendTarget;
  letter: Letter;
  stamp?: string;
  className?: string;
}) {
  const saveAi = useDunn((s) => s.saveAiLetter);
  const gmailTokens = useDunn((s) => s.gmailTokens);

  const [busy, setBusy] = useState<"warmer" | "sharper" | "shorter" | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const text = `${letter.subject}\n\n${letter.body}`;
  const validRecipient = isValidEmail(matter.clientEmail);

  const sentEntry =
    target === "invoice"
      ? matter.invoiceSentAt
        ? { sentAt: matter.invoiceSentAt, method: matter.invoiceSentMethod }
        : null
      : (matter.sentLog.find((x) => x.stage === target) ?? null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not access clipboard. Select and copy the text manually.");
    }
  }

  async function sendViaGmail() {
    if (!gmailTokens) {
      toast.error("Connect Gmail in settings first.");
      return;
    }
    if (!validRecipient) {
      toast.error("Add a client email address on this file before sending.");
      return;
    }
    setSending(true);
    try {
      const res = await sendMatterTargetViaGmail(matter, target, "gmail");
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Sent via Gmail to ${res.to}`);
    } finally {
      setSending(false);
    }
  }

  async function rewrite(direction: "warmer" | "sharper" | "shorter") {
    if (target === "invoice") return;
    setBusy(direction);
    try {
      const res = await rewriteLetter({
        data: {
          subject: letter.subject,
          body: letter.body,
          direction,
          facts: [
            `Client: ${matter.clientName} (${matter.clientCompany || "—"})`,
            `Invoice ${matter.invoiceNumber} for ${matter.amount} ${matter.currency}`,
            `Issued ${matter.issuedOn}, due ${matter.dueOn}`,
            `Work: ${matter.workDescription}`,
            `From: ${matter.yourName} / ${matter.yourBusiness}`,
          ].join("\n"),
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      saveAi(matter.id, target, res.subject, res.body);
      toast.success("Rewrite saved on this file");
    } catch {
      toast.error("Rewrite failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      className={cn(
        "print-sheet relative overflow-hidden rounded-xl bg-paper text-ink shadow-[0_18px_50px_-24px_rgb(0_0_0_/_0.55)]",
        className,
      )}
    >
      {stamp ? (
        <div
          aria-hidden
          className="pointer-events-none absolute top-6 right-5 rotate-12 rounded-sm border-2 border-danger/70 px-2 py-0.5 font-serif text-xs tracking-mark text-danger/80 uppercase"
        >
          {stamp}
        </div>
      ) : null}
      <div className="border-b border-ink/10 px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
          <span className="truncate">
            To:{" "}
            <span className={validRecipient ? "font-mono text-ink" : "italic text-danger"}>
              {matter.clientEmail.trim() || "No client email on file"}
            </span>
          </span>
          {sentEntry ? (
            <span className="font-mono text-2xs uppercase tracking-wide text-ink-muted">
              {sentEntry.method === "gmail-auto"
                ? `Auto-sent via Gmail · ${prettyDate(sentEntry.sentAt.slice(0, 10))}`
                : sentEntry.method === "gmail"
                  ? `Sent via Gmail · ${prettyDate(sentEntry.sentAt.slice(0, 10))}`
                  : `Marked sent · ${prettyDate(sentEntry.sentAt.slice(0, 10))}`}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-2xs font-medium tracking-mark text-ink-muted uppercase">Subject</p>
        <p className="mt-1 font-serif text-xl leading-snug text-ink">{letter.subject}</p>
      </div>
      <pre className="whitespace-pre-wrap px-5 py-6 font-sans text-sm leading-relaxed text-ink sm:px-7">
        {letter.body}
      </pre>
      <div className="no-print flex flex-wrap gap-2 border-t border-ink/10 px-5 py-3 sm:px-7">
        {gmailTokens ? (
          <Button
            size="sm"
            variant="default"
            onClick={() => void sendViaGmail()}
            disabled={sending || !validRecipient}
            className="bg-ink text-paper"
          >
            {sending ? <LoaderCircle className="animate-spin" /> : <Send />}
            {sending ? "Sending…" : sentEntry ? "Resend via Gmail" : "Send via Gmail"}
          </Button>
        ) : (
          <Button asChild size="sm" variant="default" className="bg-ink text-paper">
            <Link to="/settings">
              <Mail />
              Connect Gmail to send
            </Link>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => void copy()}
          className="border-ink/15 text-ink hover:bg-ink/5"
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy letter"}
        </Button>
        {target !== "invoice"
          ? (["warmer", "sharper", "shorter"] as const).map((dir) => (
              <Button
                key={dir}
                size="sm"
                variant="outline"
                className="border-ink/15 text-ink hover:bg-ink/5"
                disabled={busy !== null}
                onClick={() => void rewrite(dir)}
              >
                {busy === dir ? <LoaderCircle className="animate-spin" /> : null}
                {dir === "warmer" ? "Warmer" : dir === "sharper" ? "Sharper" : "Shorter"}
              </Button>
            ))
          : null}
      </div>
    </article>
  );
}
