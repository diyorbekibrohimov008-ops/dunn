import type { GmailOAuthConfig, GmailTokens } from "./types.ts";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const EXPIRY_BUFFER_MS = 60_000;

export function resolveOAuthCredentials(
  custom?: Partial<GmailOAuthConfig> | null,
): { clientId: string; clientSecret: string; source: "env" | "custom" } | null {
  const envId = process.env.GOOGLE_CLIENT_ID?.trim();
  const envSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (envId && envSecret) {
    return { clientId: envId, clientSecret: envSecret, source: "env" };
  }
  const customId = custom?.clientId?.trim();
  const customSecret = custom?.clientSecret?.trim();
  if (customId && customSecret) {
    return { clientId: customId, clientSecret: customSecret, source: "custom" };
  }
  return null;
}

export function getServerOAuthStatus(): {
  serverConfigured: boolean;
  clientIdPreview: string | null;
} {
  const envId = process.env.GOOGLE_CLIENT_ID?.trim();
  const envSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (envId && envSecret) {
    const preview =
      envId.length > 18 ? `${envId.slice(0, 10)}…${envId.slice(-8)}` : envId;
    return { serverConfigured: true, clientIdPreview: preview };
  }
  return { serverConfigured: false, clientIdPreview: null };
}

export function isValidCallbackUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return parsed.pathname === "/gmail-callback";
  } catch {
    return false;
  }
}

export function isValidEmailAddress(email: string): boolean {
  const trimmed = email.trim();
  return EMAIL_RE.test(trimmed) && !/[\r\n]/.test(trimmed);
}

export function buildGmailAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", params.state);
  return url.toString();
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeRfc2047IfNeeded(value: string): string {
  const clean = sanitizeHeaderValue(value);
  if (!clean) return "";
  const isAsciiPrintable = /^[\x20-\x7e]*$/.test(clean);
  if (isAsciiPrintable) return clean;
  const b64 = Buffer.from(clean, "utf8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

function formatFromHeader(fromEmail: string, fromName?: string): string {
  const email = sanitizeHeaderValue(fromEmail);
  const name = sanitizeHeaderValue(fromName ?? "").replace(/["\\<>]/g, "");
  if (!name) return email;
  const encodedName = encodeRfc2047IfNeeded(name);
  return encodedName.startsWith("=?") ? `${encodedName} <${email}>` : `"${encodedName}" <${email}>`;
}

function wrapBase64(b64: string, width = 76): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += width) {
    lines.push(b64.slice(i, i + width));
  }
  return lines.join("\r\n");
}

export function buildRawMimeMessage(input: {
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  to: string;
  subject: string;
  body: string;
}): string {
  const to = sanitizeHeaderValue(input.to);
  const fromEmail = sanitizeHeaderValue(input.fromEmail);
  if (!isValidEmailAddress(to)) {
    throw new Error("Client email address is invalid.");
  }
  if (!isValidEmailAddress(fromEmail)) {
    throw new Error("Connected Gmail address is invalid.");
  }

  const headers: string[] = [
    `From: ${formatFromHeader(fromEmail, input.fromName)}`,
    `To: ${to}`,
  ];

  const replyTo = input.replyTo ? sanitizeHeaderValue(input.replyTo) : "";
  if (replyTo && replyTo.toLowerCase() !== fromEmail.toLowerCase() && isValidEmailAddress(replyTo)) {
    headers.push(`Reply-To: ${replyTo}`);
  }

  headers.push(
    `Subject: ${encodeRfc2047IfNeeded(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  );

  const normalizedBody = input.body.replace(/\r?\n/g, "\r\n");
  const encodedBody = wrapBase64(Buffer.from(normalizedBody, "utf8").toString("base64"));
  const mime = `${headers.join("\r\n")}\r\n\r\n${encodedBody}\r\n`;
  return Buffer.from(mime, "utf8").toString("base64url");
}

function extractEmailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const json = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      email?: unknown;
    };
    return typeof json.email === "string" && isValidEmailAddress(json.email)
      ? json.email.trim()
      : null;
  } catch {
    return null;
  }
}

async function fetchGoogleUserEmail(
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  const res = await fetchImpl(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: unknown };
  return typeof data.email === "string" && isValidEmailAddress(data.email)
    ? data.email.trim()
    : null;
}

function parseGoogleError(json: Record<string, unknown>, fallback: string): {
  code: string;
  message: string;
} {
  const errObj =
    json.error && typeof json.error === "object"
      ? (json.error as { status?: unknown; message?: unknown })
      : null;
  const code =
    typeof json.error === "string"
      ? json.error
      : typeof errObj?.status === "string"
        ? errObj.status
        : "";
  const message =
    typeof json.error_description === "string"
      ? json.error_description
      : typeof errObj?.message === "string"
        ? errObj.message
        : fallback;
  return { code, message };
}

export async function exchangeCodeForTokens(
  input: {
    code: string;
    redirectUri: string;
    creds: { clientId: string; clientSecret: string };
  },
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; tokens: GmailTokens } | { ok: false; error: string }> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.creds.clientId,
    client_secret: input.creds.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const parsed = parseGoogleError(json, `Token exchange failed (${res.status}).`);
    return { ok: false, error: parsed.message };
  }

  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  const refreshToken = typeof json.refresh_token === "string" ? json.refresh_token : "";
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  const idToken = typeof json.id_token === "string" ? json.id_token : undefined;

  if (!accessToken) {
    return { ok: false, error: "Google did not return an access token." };
  }
  if (!refreshToken) {
    return {
      ok: false,
      error:
        "Google did not return a refresh token. Revoke this app in Google Account Permissions and reconnect so offline sending stays authorized.",
    };
  }

  const email =
    (await fetchGoogleUserEmail(accessToken, fetchImpl)) ??
    extractEmailFromIdToken(idToken);
  if (!email) {
    return {
      ok: false,
      error: "Connected to Google, but could not verify the Gmail address.",
    };
  }

  return {
    ok: true,
    tokens: {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
      email,
      connectedAt: new Date().toISOString(),
    },
  };
}

export async function refreshAccessToken(
  input: {
    refreshToken: string;
    creds: { clientId: string; clientSecret: string };
  },
  fetchImpl: typeof fetch = fetch,
): Promise<
  | { ok: true; accessToken: string; expiresAt: number; refreshToken?: string }
  | { ok: false; reconnectRequired?: boolean; error: string }
> {
  const body = new URLSearchParams({
    refresh_token: input.refreshToken,
    client_id: input.creds.clientId,
    client_secret: input.creds.clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const parsed = parseGoogleError(json, `Token refresh failed (${res.status}).`);
    const reconnectRequired =
      parsed.code === "invalid_grant" || res.status === 400 || res.status === 401;
    return {
      ok: false,
      reconnectRequired,
      error: reconnectRequired
        ? "Gmail authorization expired or was revoked. Reconnect Gmail in settings."
        : parsed.message,
    };
  }

  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  const newRefreshToken =
    typeof json.refresh_token === "string" && json.refresh_token
      ? json.refresh_token
      : undefined;

  if (!accessToken) {
    return { ok: false, error: "Google did not return a refreshed access token." };
  }

  return {
    ok: true,
    accessToken,
    expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
    ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
  };
}

async function postGmailSend(
  accessToken: string,
  raw: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; messageId: string } | { ok: false; status: number; error: string }> {
  const res = await fetchImpl(GMAIL_SEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const parsed = parseGoogleError(json, `Gmail send failed (${res.status}).`);
    if (res.status === 403 && parsed.message.toLowerCase().includes("disabled")) {
      return {
        ok: false,
        status: res.status,
        error: "Gmail API is not enabled in the Google Cloud project yet.",
      };
    }
    return { ok: false, status: res.status, error: parsed.message };
  }

  const messageId = typeof json.id === "string" ? json.id : "";
  return { ok: true, messageId };
}

export async function sendEmailWithGmail(
  input: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    fromEmail: string;
    fromName?: string;
    replyTo?: string;
    to: string;
    subject: string;
    body: string;
    creds: { clientId: string; clientSecret: string } | null;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<
  | {
      ok: true;
      messageId: string;
      refreshedToken?: { accessToken: string; expiresAt: number; refreshToken?: string };
    }
  | { ok: false; reconnectRequired?: boolean; error: string }
> {
  let raw: string;
  try {
    raw = buildRawMimeMessage({
      fromEmail: input.fromEmail,
      fromName: input.fromName,
      replyTo: input.replyTo,
      to: input.to,
      subject: input.subject,
      body: input.body,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid email payload." };
  }

  let activeToken = input.accessToken;
  let refreshedToken:
    | { accessToken: string; expiresAt: number; refreshToken?: string }
    | undefined;

  const needsPreemptiveRefresh =
    typeof input.expiresAt === "number" &&
    Date.now() >= input.expiresAt - EXPIRY_BUFFER_MS &&
    Boolean(input.refreshToken) &&
    Boolean(input.creds);

  if (needsPreemptiveRefresh && input.refreshToken && input.creds) {
    const refreshed = await refreshAccessToken(
      { refreshToken: input.refreshToken, creds: input.creds },
      fetchImpl,
    );
    if (!refreshed.ok) return refreshed;
    activeToken = refreshed.accessToken;
    refreshedToken = {
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.expiresAt,
      ...(refreshed.refreshToken ? { refreshToken: refreshed.refreshToken } : {}),
    };
  }

  let sent = await postGmailSend(activeToken, raw, fetchImpl);
  if (!sent.ok && sent.status === 401 && input.refreshToken && input.creds && !refreshedToken) {
    const refreshed = await refreshAccessToken(
      { refreshToken: input.refreshToken, creds: input.creds },
      fetchImpl,
    );
    if (!refreshed.ok) return refreshed;
    activeToken = refreshed.accessToken;
    refreshedToken = {
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.expiresAt,
      ...(refreshed.refreshToken ? { refreshToken: refreshed.refreshToken } : {}),
    };
    sent = await postGmailSend(activeToken, raw, fetchImpl);
  }

  if (!sent.ok) {
    return {
      ok: false,
      reconnectRequired: sent.status === 401,
      error: sent.error,
    };
  }

  return {
    ok: true,
    messageId: sent.messageId,
    ...(refreshedToken ? { refreshedToken } : {}),
  };
}
