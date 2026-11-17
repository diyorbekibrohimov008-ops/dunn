import { useEffect } from "react";
import { toast } from "sonner";
import { sendGmailLetter } from "./gmail";
import { buildInvoiceEmail, buildLetter, stageLabel } from "./letters";
import { diagnose } from "./recovery";
import { useDunn } from "./store";
import type { Matter, SendMethod, StageId } from "./types";

export type SendTarget = "invoice" | StageId;

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const inFlightSends = new Set<string>();
let autoPassRunning = false;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function isExampleEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  const domain = lower.split("@")[1] ?? "";
  return (
    domain === "example.com" ||
    domain === "example.org" ||
    domain === "example.net" ||
    domain.endsWith(".example")
  );
}

export function describeTarget(target: SendTarget): string {
  return target === "invoice" ? "Invoice" : stageLabel(target);
}

export function readyTargetForMatter(matter: Matter): SendTarget | null {
  if (matter.markedPaidAt || matter.writtenOffAt) return null;
  const d = diagnose(matter);
  if (d.days < 0) {
    return matter.invoiceSentAt ? null : "invoice";
  }
  const alreadySent = matter.sentLog.some((x) => x.stage === d.stage);
  return alreadySent ? null : d.stage;
}

export function isAutoSendEligible(matter: Matter): boolean {
  if (matter.isSample) return false;
  if (!matter.autoSend) return false;
  if (matter.markedPaidAt || matter.writtenOffAt) return false;
  if (!isValidEmail(matter.clientEmail)) return false;
  if (isExampleEmail(matter.clientEmail)) return false;
  return true;
}

export type SendMatterResult =
  | { ok: true; messageId: string; to: string; target: SendTarget }
  | { ok: false; error: string; skipped?: boolean; reconnectRequired?: boolean };

export async function sendMatterTargetViaGmail(
  matter: Matter,
  target: SendTarget,
  mode: Exclude<SendMethod, "manual"> = "gmail",
): Promise<SendMatterResult> {
  const state = useDunn.getState();
  const tokens = state.gmailTokens;
  if (!tokens) {
    return { ok: false, error: "Connect Gmail in settings first." };
  }

  const to = matter.clientEmail.trim();
  if (!isValidEmail(to)) {
    return { ok: false, error: "Add a valid client email address before sending." };
  }

  if (mode === "gmail-auto" && (matter.isSample || isExampleEmail(to))) {
    return {
      ok: false,
      skipped: true,
      error: "Sample files and .example addresses are never auto-sent.",
    };
  }

  const lockKey = `${matter.id}:${target}`;
  if (inFlightSends.has(lockKey)) {
    return { ok: false, skipped: true, error: "Already sending this notice." };
  }

  inFlightSends.add(lockKey);
  try {
    const letter =
      target === "invoice"
        ? buildInvoiceEmail(matter)
        : matter.aiLetters[target] ?? buildLetter(matter, target);

    const fromName = matter.yourBusiness.trim() || matter.yourName.trim() || undefined;
    const replyTo = isValidEmail(matter.yourEmail) ? matter.yourEmail.trim() : undefined;

    const res = await sendGmailLetter({
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        fromEmail: tokens.email,
        fromName,
        replyTo,
        to,
        subject: letter.subject,
        body: letter.body,
        customConfig: state.gmailOAuthConfig,
      },
    });

    if (!res.ok) {
      if (mode === "gmail-auto") {
        useDunn.getState().setMatterAutoError(matter.id, {
          key: String(target),
          at: new Date().toISOString(),
          message: res.error,
        });
      }
      return {
        ok: false,
        error: res.error,
        reconnectRequired: res.reconnectRequired,
      };
    }

    if (res.refreshedToken) {
      useDunn
        .getState()
        .updateGmailAccessToken(
          res.refreshedToken.accessToken,
          res.refreshedToken.expiresAt,
          res.refreshedToken.refreshToken,
        );
    }

    const meta = { method: mode, to, messageId: res.messageId };
    if (target === "invoice") {
      useDunn.getState().markInvoiceSent(matter.id, meta);
    } else {
      useDunn.getState().markSent(matter.id, target, meta);
    }

    return { ok: true, messageId: res.messageId, to, target };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not reach Gmail server function.";
    if (mode === "gmail-auto") {
      useDunn.getState().setMatterAutoError(matter.id, {
        key: String(target),
        at: new Date().toISOString(),
        message: msg,
      });
    }
    return { ok: false, error: msg };
  } finally {
    inFlightSends.delete(lockKey);
  }
}

export async function runAutoSendPass(options?: {
  includeFutureInvoices?: boolean;
  ignorePreviousErrors?: boolean;
}): Promise<{ sentCount: number; errorCount: number }> {
  if (autoPassRunning) return { sentCount: 0, errorCount: 0 };

  const state = useDunn.getState();
  if (!state.hydrated || !state.gmailTokens) {
    return { sentCount: 0, errorCount: 0 };
  }

  autoPassRunning = true;
  let sentCount = 0;
  let errorCount = 0;

  try {
    const candidates = state.matters.filter(isAutoSendEligible);
    for (const matter of candidates) {
      const target = readyTargetForMatter(matter);
      if (!target) continue;
      if (target === "invoice" && !options?.includeFutureInvoices) continue;
      if (!options?.ignorePreviousErrors && matter.lastAutoError?.key === String(target)) {
        continue;
      }

      const res = await sendMatterTargetViaGmail(matter, target, "gmail-auto");
      if (res.ok) {
        sentCount += 1;
        toast.success(
          `Auto-sent ${describeTarget(target)} for ${matter.invoiceNumber} to ${res.to}`,
        );
      } else if (!res.skipped) {
        errorCount += 1;
        toast.error(`Auto-send failed for ${matter.invoiceNumber}: ${res.error}`);
        if (res.reconnectRequired) break;
      }
    }
  } finally {
    autoPassRunning = false;
  }

  return { sentCount, errorCount };
}

export function AutoSendRunner() {
  const hydrated = useDunn((s) => s.hydrated);
  const gmailEmail = useDunn((s) => s.gmailTokens?.email ?? null);
  const autoFollowups = useDunn((s) => s.autoSendSettings.autoSendDueFollowups);
  const mattersCount = useDunn((s) => s.matters.length);

  useEffect(() => {
    if (!hydrated || !gmailEmail || !autoFollowups) return;
    void runAutoSendPass({ includeFutureInvoices: false });
  }, [hydrated, gmailEmail, autoFollowups, mattersCount]);

  return null;
}
