import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  subject: z.string().max(200),
  body: z.string().min(20).max(6000),
  facts: z.string().max(1500),
  direction: z.enum(["warmer", "sharper", "shorter"]),
});

export const rewriteLetter = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI rewrite is not available in this environment." };
    }

    const directionNote =
      data.direction === "warmer"
        ? "Make it warmer and more human, without becoming apologetic or groveling."
        : data.direction === "sharper"
          ? "Make it firmer and more direct. No insults, no all-caps, no invented legal threats."
          : "Cut it by about 30%. Keep every fact. No throat-clearing.";

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 700,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You rewrite overdue-invoice emails for freelancers and small operators. Keep every invoice number, amount, date, name, and fee exactly. Do not invent laws, statutes, or threats that are not already in the draft. Do not add emoji. Return ONLY compact JSON with keys subject and body. Body uses plain newlines, no markdown.",
          },
          {
            role: "user",
            content: `Direction: ${directionNote}\n\nFacts (do not contradict):\n${data.facts}\n\nCurrent subject:\n${data.subject}\n\nCurrent body:\n${data.body}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false as const, error: `Rewrite failed (${res.status}). Try again in a moment.` };
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(text);
    if (!parsed) {
      return { ok: false as const, error: "Could not read the rewrite. Try again." };
    }
    return { ok: true as const, subject: parsed.subject, body: parsed.body };
  });

function extractJson(text: string): { subject: string; body: string } | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/\{[\s\S]*\}/);
  const raw = fence ? fence[0] : trimmed;
  try {
    const obj = JSON.parse(raw) as { subject?: unknown; body?: unknown };
    if (typeof obj.subject === "string" && typeof obj.body === "string") {
      return { subject: obj.subject.slice(0, 200), body: obj.body.slice(0, 6000) };
    }
  } catch {
    return null;
  }
  return null;
}
