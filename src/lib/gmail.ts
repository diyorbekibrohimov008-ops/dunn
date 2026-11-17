import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const customConfigSchema = z
  .object({
    clientId: z.string().max(400),
    clientSecret: z.string().max(400),
  })
  .nullable()
  .optional();

const authUrlInputSchema = z.object({
  redirectUri: z.string().url().max(500),
  state: z.string().min(12).max(200),
  customConfig: customConfigSchema,
});

const exchangeCodeInputSchema = z.object({
  code: z.string().min(4).max(2000),
  redirectUri: z.string().url().max(500),
  customConfig: customConfigSchema,
});

const refreshTokenInputSchema = z.object({
  refreshToken: z.string().min(4).max(2000),
  customConfig: customConfigSchema,
});

const sendLetterInputSchema = z.object({
  accessToken: z.string().min(4).max(4000),
  refreshToken: z.string().max(2000).optional(),
  expiresAt: z.number().optional(),
  fromEmail: z.string().email().max(320),
  fromName: z.string().max(200).optional(),
  replyTo: z.string().max(320).optional(),
  to: z.string().email().max(320),
  subject: z.string().min(1).max(400),
  body: z.string().min(1).max(20000),
  customConfig: customConfigSchema,
});

export const getGmailConfigStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getServerOAuthStatus } = await import("./gmail.server.ts");
  return getServerOAuthStatus();
});

export const getGmailAuthUrl = createServerFn({ method: "POST" })
  .validator((input: unknown) => authUrlInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { buildGmailAuthUrl, isValidCallbackUrl, resolveOAuthCredentials } = await import(
      "./gmail.server.ts"
    );

    if (!isValidCallbackUrl(data.redirectUri)) {
      return { ok: false as const, error: "Invalid Gmail OAuth callback URL." };
    }

    const creds = resolveOAuthCredentials(data.customConfig);
    if (!creds) {
      return {
        ok: false as const,
        error:
          "Google OAuth credentials are not configured yet. Add your Google Client ID & Secret below or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.",
      };
    }

    const url = buildGmailAuthUrl({
      clientId: creds.clientId,
      redirectUri: data.redirectUri,
      state: data.state,
    });
    return { ok: true as const, url };
  });

export const exchangeGmailCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => exchangeCodeInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { exchangeCodeForTokens, isValidCallbackUrl, resolveOAuthCredentials } = await import(
      "./gmail.server.ts"
    );

    if (!isValidCallbackUrl(data.redirectUri)) {
      return { ok: false as const, error: "Invalid Gmail OAuth callback URL." };
    }

    const creds = resolveOAuthCredentials(data.customConfig);
    if (!creds) {
      return {
        ok: false as const,
        error: "Google OAuth credentials are missing. Re-open settings and add them first.",
      };
    }

    return exchangeCodeForTokens({
      code: data.code,
      redirectUri: data.redirectUri,
      creds,
    });
  });

export const refreshGmailToken = createServerFn({ method: "POST" })
  .validator((input: unknown) => refreshTokenInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { refreshAccessToken, resolveOAuthCredentials } = await import("./gmail.server.ts");
    const creds = resolveOAuthCredentials(data.customConfig);
    if (!creds) {
      return {
        ok: false as const,
        reconnectRequired: false,
        error: "Google OAuth credentials are not configured to refresh the Gmail token.",
      };
    }
    return refreshAccessToken({ refreshToken: data.refreshToken, creds });
  });

export const sendGmailLetter = createServerFn({ method: "POST" })
  .validator((input: unknown) => sendLetterInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { resolveOAuthCredentials, sendEmailWithGmail } = await import("./gmail.server.ts");
    const creds = resolveOAuthCredentials(data.customConfig);

    return sendEmailWithGmail({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      fromEmail: data.fromEmail,
      fromName: data.fromName,
      replyTo: data.replyTo,
      to: data.to,
      subject: data.subject,
      body: data.body,
      creds,
    });
  });
