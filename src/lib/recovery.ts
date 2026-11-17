import type { Matter, StageId, StageMeta } from "./types";
import { daysBetween, todayISO } from "./format";

export const STAGES: StageMeta[] = [
  {
    id: 1,
    name: "Courtesy",
    short: "A quiet check-in",
    when: "On the due date, or the next business day",
    typicalDay: 0,
  },
  {
    id: 2,
    name: "Nudge",
    short: "Did it land?",
    when: "3–5 days overdue",
    typicalDay: 4,
  },
  {
    id: 3,
    name: "Firm",
    short: "A date and a fee",
    when: "7 days overdue",
    typicalDay: 7,
  },
  {
    id: 4,
    name: "Pause",
    short: "Last informal notice",
    when: "14 days overdue",
    typicalDay: 14,
  },
  {
    id: 5,
    name: "Demand",
    short: "The formal letter",
    when: "30 days overdue",
    typicalDay: 30,
  },
];

/** Empirical recovery curve used by collections desks. */
const CURVE: [number, number][] = [
  [-14, 0.98],
  [0, 0.95],
  [7, 0.9],
  [14, 0.84],
  [30, 0.73],
  [45, 0.62],
  [60, 0.55],
  [90, 0.5],
  [120, 0.38],
  [180, 0.25],
  [270, 0.16],
  [365, 0.1],
  [540, 0.05],
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function recoveryProbability(daysOverdue: number): number {
  if (daysOverdue <= CURVE[0][0]) return CURVE[0][1];
  for (let i = 1; i < CURVE.length; i++) {
    const [d0, p0] = CURVE[i - 1];
    const [d1, p1] = CURVE[i];
    if (daysOverdue <= d1) {
      const t = (daysOverdue - d0) / (d1 - d0);
      return lerp(p0, p1, t);
    }
  }
  return CURVE[CURVE.length - 1][1];
}

export function daysOverdue(matter: Matter, on = todayISO()): number {
  return daysBetween(matter.dueOn, on);
}

export function lastSentStage(matter: Matter): 0 | StageId {
  if (matter.sentLog.length === 0) return 0;
  return Math.max(...matter.sentLog.map((s) => s.stage)) as StageId;
}

export function calendarStage(days: number): StageId {
  if (days >= 30) return 5;
  if (days >= 14) return 4;
  if (days >= 7) return 3;
  if (days >= 3) return 2;
  return 1;
}

export function recommendedStage(matter: Matter, on = todayISO()): StageId {
  const days = daysOverdue(matter, on);
  const last = lastSentStage(matter);
  const cal = calendarStage(Math.max(0, days));
  if (last >= 5) return 5;
  if (days < 0) return 1;
  return Math.max((last + 1) as StageId, cal) as StageId;
}

export type AgeBand = "watch" | "fresh" | "warm" | "aging" | "risk" | "cold";

export function ageBand(days: number): AgeBand {
  if (days < 0) return "watch";
  if (days <= 7) return "fresh";
  if (days <= 14) return "warm";
  if (days <= 30) return "aging";
  if (days <= 90) return "risk";
  return "cold";
}

export const BAND_LABEL: Record<AgeBand, string> = {
  watch: "Not yet due",
  fresh: "Fresh",
  warm: "Warm",
  aging: "Aging",
  risk: "At risk",
  cold: "Cold",
};

export function lateFee(amount: number, days: number, monthlyRate = 0.015): number {
  if (days <= 0) return 0;
  const months = days / 30;
  return Math.round(Math.max(0, amount * monthlyRate * months) * 100) / 100;
}

export type PathId = "sequence" | "demand" | "claims" | "agency" | "write-off";

export interface PathAdvice {
  path: PathId;
  title: string;
  why: string;
}

export function advisePath(matter: Matter, on = todayISO()): PathAdvice {
  const days = daysOverdue(matter, on);
  const p = recoveryProbability(days);
  const expected = matter.amount * p;
  const last = lastSentStage(matter);

  if (matter.markedPaidAt) {
    return { path: "sequence", title: "Paid", why: "This file is closed." };
  }
  if (matter.writtenOffAt) {
    return { path: "write-off", title: "Written off", why: "Kept on file for the record." };
  }
  if (days < 0) {
    return {
      path: "sequence",
      title: "Queue the courtesy note",
      why: "Send it on the due date so the clock is real.",
    };
  }
  if (days >= 180 && expected < 120 && last >= 4) {
    return {
      path: "write-off",
      title: "Consider a write-off",
      why: "Expected recovery is now smaller than the hours it takes to chase. Keep the demand letter on file.",
    };
  }
  if (days >= 90 && matter.amount >= 1500 && last >= 4) {
    return {
      path: "claims",
      title: "Small claims is on the table",
      why: "Past 90 days, DIY odds sit near a coin flip. A claim is often cheaper than an agency’s cut.",
    };
  }
  if (days >= 60 && matter.amount >= 4000 && last >= 5) {
    return {
      path: "agency",
      title: "Agency only as a last cut",
      why: "They keep 25–50% of whatever they collect. Use them when the file is cold and the amount is large.",
    };
  }
  if (days >= 30) {
    return {
      path: "demand",
      title: "Send the demand letter this week",
      why: "At this age a courtesy note reads as optional. A dated demand is the document that changes the file.",
    };
  }
  return {
    path: "sequence",
    title: "Stay on the sequence",
    why: "Most late invoices clear here — short, dated, unemotional notes, a few days apart.",
  };
}

export interface Diagnosis {
  days: number;
  band: AgeBand;
  probability: number;
  expected: number;
  expectedIn30: number;
  waitCost30: number;
  fee: number;
  stage: StageId;
  last: 0 | StageId;
  path: PathAdvice;
  skipCourtesy: boolean;
}

export function diagnose(matter: Matter, on = todayISO()): Diagnosis {
  const days = daysOverdue(matter, on);
  const probability = recoveryProbability(days);
  const expected = matter.amount * probability;
  const expectedIn30 = matter.amount * recoveryProbability(days + 30);
  const stage = recommendedStage(matter, on);
  const last = lastSentStage(matter);
  return {
    days,
    band: ageBand(days),
    probability,
    expected,
    expectedIn30,
    waitCost30: Math.max(0, expected - expectedIn30),
    fee: lateFee(matter.amount, Math.max(0, days)),
    stage,
    last,
    path: advisePath(matter, on),
    skipCourtesy: days >= 14 && last === 0,
  };
}

export function openMatters(matters: Matter[]): Matter[] {
  return matters.filter((m) => !m.markedPaidAt && !m.writtenOffAt);
}

export function totals(matters: Matter[]) {
  const open = openMatters(matters);
  const atRisk = open.reduce((s, m) => s + m.amount, 0);
  const expected = open.reduce((s, m) => s + m.amount * recoveryProbability(daysOverdue(m)), 0);
  const waitCost = open.reduce((s, m) => {
    const d = diagnose(m);
    return s + d.waitCost30;
  }, 0);
  return { count: open.length, atRisk, expected, waitCost };
}

export const CURVE_POINTS = CURVE;
