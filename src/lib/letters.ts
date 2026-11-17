import type { Letter, Matter, Relationship, StageId } from "./types";
import { addDaysISO, money, prettyDateLong, todayISO } from "./format";
import { diagnose, lateFee, STAGES } from "./recovery";

function firstName(full: string): string {
  const t = full.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? t;
}

function cleanYourName(name: string): string {
  const t = name.trim();
  return t === "Your name" ? "" : t;
}

function signOff(m: Matter): string {
  const biz = m.yourBusiness.trim();
  const name = cleanYourName(m.yourName);
  if (biz && name) return `${name}\n${biz}`;
  return biz || name || "Accounts";
}

function opener(rel: Relationship, client: string): string {
  const n = firstName(client);
  if (rel === "friendly") return `Hi ${n},`;
  if (rel === "strained") return `${n},`;
  return `Hello ${n},`;
}

function workLine(m: Matter): string {
  const w = m.workDescription.trim();
  return w ? ` for ${w.replace(/\.$/, "")}` : "";
}

function payLine(m: Matter): string {
  const email = m.yourEmail.trim();
  return email
    ? `If you need the invoice resent, reply to this note or write ${email}.`
    : "If you need the invoice resent, reply to this note.";
}

function dueDeadline(daysOut = 7): string {
  return prettyDateLong(addDaysISO(todayISO(), daysOut));
}

export function buildLetter(matter: Matter, stage: StageId): Letter {
  const d = diagnose(matter);
  const amount = money(matter.amount, matter.currency);
  const due = prettyDateLong(matter.dueOn);
  const inv = matter.invoiceNumber;
  const days = Math.max(0, d.days);
  const fee = money(d.fee, matter.currency);
  const rel = matter.relationship;
  const hi = opener(rel, matter.clientName);
  const sign = signOff(matter);
  const work = workLine(matter);
  const company = matter.clientCompany.trim();
  const who = company ? `${matter.clientName} / ${company}` : matter.clientName;

  if (stage === 1) {
    return {
      subject: `Checking in on invoice ${inv}`,
      body: `${hi}

Quick note that invoice ${inv} (${amount}${work}) was due on ${due}. If payment is already on the way, you can ignore this.

${payLine(matter)}

Thank you,
${sign}`,
    };
  }

  if (stage === 2) {
    return {
      subject: `Invoice ${inv} — still open`,
      body: `${hi}

Following up on invoice ${inv} for ${amount}, due ${due}. Could you confirm it reached the person who approves payment, and when it is likely to be paid?

If anything on the invoice needs a correction, tell me and I will fix it today.

Thank you,
${sign}`,
    };
  }

  if (stage === 3) {
    const by = dueDeadline(7);
    const feeLine =
      rel === "strained"
        ? `A late fee of ${fee} is now on the table under our terms.`
        : `Per our terms, a late fee of ${fee} may apply if this remains unpaid after ${by}.`;
    return {
      subject: `Overdue: invoice ${inv} (${amount})`,
      body: `${hi}

Invoice ${inv} for ${amount}${work} is now ${days} days past the due date of ${due}.

Please arrange payment by ${by}. ${feeLine}

If there is a blocker I do not know about, I need to hear it this week so we can close the file cleanly.

${sign}`,
    };
  }

  if (stage === 4) {
    const by = dueDeadline(7);
    return {
      subject: `Action needed — invoice ${inv} is ${days} days overdue`,
      body: `${hi}

Invoice ${inv} remains unpaid (${amount}, originally due ${due}).

Please settle the balance by ${by}. If I do not receive payment or a written payment date by then, I will pause further work and apply the late fee of ${fee}.

I would rather keep this between us. Please treat this as the last informal notice.

${sign}`,
    };
  }

  return demandLetter(matter, who, amount, due, inv, days, fee, work, sign);
}

function demandLetter(
  matter: Matter,
  who: string,
  amount: string,
  due: string,
  inv: string,
  days: number,
  fee: string,
  work: string,
  sign: string,
): Letter {
  const by = dueDeadline(10);
  const issued = prettyDateLong(matter.issuedOn);
  const today = prettyDateLong(todayISO());
  const terms = matter.termsNote.trim();
  const termsLine = terms
    ? `The agreed terms: ${terms}`
    : "Payment was due on the date stated on the invoice.";
  const email = matter.yourEmail.trim();
  const contact = email ? ` Correspondence: ${email}.` : "";

  return {
    subject: `FORMAL DEMAND FOR PAYMENT — Invoice ${inv} (${amount})`,
    body: `${today}

${who}

Re: Formal demand for payment
Invoice ${inv} · ${amount} · originally due ${due}

This letter is a formal demand for payment of invoice ${inv}, issued ${issued}${work}. The invoice was due on ${due} and is now ${days} days overdue.

Amount originally due: ${amount}
Suggested late fee to date: ${fee}
Total requested: ${amount} plus any agreed late charges

${termsLine}

Demand: pay the outstanding balance in full by ${by}.

If payment (or a written proposal with a specific payment date) is not received by that date, I reserve the right to pause remaining work, decline further engagements, and pursue available remedies, including small-claims proceedings or a licensed collection agency. This letter will be kept as a record of notice.

This is an attempt to collect a debt. Please give it your immediate attention.${contact}

Sincerely,
${sign}`,
  };
}

export function buildPhoneScript(matter: Matter): { goal: string; script: string } {
  const d = diagnose(matter);
  const amount = money(matter.amount, matter.currency);
  const inv = matter.invoiceNumber;
  const due = prettyDateLong(matter.dueOn);
  const name = firstName(matter.clientName);
  const you = firstName(matter.yourName) || "I";

  if (d.days < 14) {
    return {
      goal: "Confirm the invoice arrived and leave with a date.",
      script: `Hi ${name}, it’s ${you}. I’m calling about invoice ${inv} for ${amount}, due ${due}. I wanted to check it reached the right person — is there a date I should expect payment?`,
    };
  }
  if (d.days < 30) {
    return {
      goal: "Get a committed date. Do not apologize for asking.",
      script: `Hi ${name}, it’s ${you}. Invoice ${inv} for ${amount} is ${d.days} days past due. I need a payment date I can put on the file. What day this week can you send it?`,
    };
  }
  return {
    goal: "Name the deadline. Mention pause / demand if they stall.",
    script: `Hi ${name}, it’s ${you}. I’m calling because invoice ${inv} for ${amount} is ${d.days} days overdue. I sent written notice and I need this settled by ${prettyDateLong(addDaysISO(todayISO(), 7))}. If it isn’t, I’ll pause work and send a formal demand. Can you pay this week?`,
  };
}

export function changeOrderLetter(input: {
  clientName: string;
  yourName: string;
  yourBusiness: string;
  originalScope: string;
  originalAmount: number;
  extra: string;
  extraAmount: number;
  currency: Matter["currency"];
}): Letter {
  const n = firstName(input.clientName);
  const orig = money(input.originalAmount, input.currency);
  const extra = money(input.extraAmount, input.currency);
  const total = money(input.originalAmount + input.extraAmount, input.currency);
  const biz = input.yourBusiness.trim();
  const sign = biz ? `${input.yourName}\n${biz}` : input.yourName;
  return {
    subject: `Change order — ${input.extra.slice(0, 48)}`,
    body: `Hi ${n},

Happy to take this on. The request below sits outside the original scope (${input.originalScope || "as quoted"}), so I want the cost on paper before I start.

Original quote: ${orig}
Added work: ${input.extra}
Change order: ${extra}
New total if approved: ${total}

Reply “approved” (or sign and send back) and I’ll schedule it. If you’d rather hold the original scope, that’s fine — I’ll finish what we already agreed.

${sign}`,
  };
}

export function buildInvoiceEmail(matter: Matter): Letter {
  const amount = money(matter.amount, matter.currency);
  const issued = prettyDateLong(matter.issuedOn);
  const due = prettyDateLong(matter.dueOn);
  const inv = matter.invoiceNumber;
  const hi = opener(matter.relationship, matter.clientName);
  const sign = signOff(matter);
  const sender = matter.yourBusiness.trim() || cleanYourName(matter.yourName);
  const work = matter.workDescription.trim();
  const terms = matter.termsNote.trim();
  const contact = matter.yourEmail.trim();

  const lines = [
    hi,
    "",
    work
      ? `Please find invoice ${inv} (${amount}) ready for ${work.replace(/\.$/, "")}.`
      : `Please find invoice ${inv} for ${amount} ready for review.`,
    "",
    `Invoice: ${inv}`,
    `Amount due: ${amount}`,
    `Issued: ${issued}`,
    `Due date: ${due}`,
    ...(terms ? [`Terms: ${terms}`] : []),
    "",
    contact
      ? `If anything on the invoice needs a correction, reply to this email or write ${contact}.`
      : "If anything on the invoice needs a correction, simply reply to this email.",
    "",
    "Thank you,",
    sign,
  ];

  return {
    subject: sender
      ? `Invoice ${inv} from ${sender} (${amount})`
      : `Invoice ${inv} (${amount}, due ${due})`,
    body: lines.join("\n"),
  };
}

export function stageLabel(id: StageId): string {
  return STAGES.find((s) => s.id === id)?.name ?? `Stage ${id}`;
}

export const DISCLAIMER =
  "Dunn drafts letters and math. It is not a law firm, a collection agency, or legal advice. Late fees and remedies depend on your contract and local law.";
