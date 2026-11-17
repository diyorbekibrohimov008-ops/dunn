import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGmailAuthUrl,
  buildRawMimeMessage,
  exchangeCodeForTokens,
  isValidCallbackUrl,
  refreshAccessToken,
  resolveOAuthCredentials,
  sendEmailWithGmail,
} from "./gmail.server.ts";

function decodeBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

describe("resolveOAuthCredentials", () => {
  it("prefers server environment variables over custom credentials", () => {
    const prevId = process.env.GOOGLE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_CLIENT_ID = "env-id";
    process.env.GOOGLE_CLIENT_SECRET = "env-secret";
    try {
      const creds = resolveOAuthCredentials({
        clientId: "custom-id",
        clientSecret: "custom-secret",
      });
      assert.deepEqual(creds, {
        clientId: "env-id",
        clientSecret: "env-secret",
        source: "env",
      });
    } finally {
      if (prevId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = prevId;
      if (prevSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = prevSecret;
    }
  });
});

describe("isValidCallbackUrl", () => {
  it("accepts /gmail-callback over http and https", () => {
    assert.equal(isValidCallbackUrl("http://localhost:8080/gmail-callback"), true);
    assert.equal(isValidCallbackUrl("https://dunn.example.com/gmail-callback"), true);
  });

  it("rejects non-callback paths and non-http protocols", () => {
    assert.equal(isValidCallbackUrl("http://localhost:8080/other"), false);
    assert.equal(isValidCallbackUrl("javascript:alert(1)"), false);
    assert.equal(isValidCallbackUrl("not-a-url"), false);
  });
});

describe("buildGmailAuthUrl", () => {
  it("includes offline access, consent prompt, gmail.send scope, and state", () => {
    const raw = buildGmailAuthUrl({
      clientId: "cid-123",
      redirectUri: "http://localhost:8080/gmail-callback",
      state: "state-xyz",
    });
    const url = new URL(raw);
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(url.searchParams.get("client_id"), "cid-123");
    assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:8080/gmail-callback");
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("prompt"), "consent");
    assert.equal(url.searchParams.get("state"), "state-xyz");
    const scope = url.searchParams.get("scope") ?? "";
    assert.match(scope, /gmail\.send/);
    assert.match(scope, /userinfo\.email/);
  });
});

describe("buildRawMimeMessage", () => {
  it("RFC-2047 encodes UTF-8 subjects and base64-encodes the body", () => {
    const raw = buildRawMimeMessage({
      fromEmail: "alex@gmail.com",
      fromName: "Rivera Studio",
      replyTo: "billing@rivera.studio",
      to: "client@acme.com",
      subject: "Invoice INV-1044 — still open",
      body: "Hello Maya,\n\nPlease settle invoice INV-1044.",
    });
    const decoded = decodeBase64Url(raw);
    assert.match(decoded, /^From: "Rivera Studio" <alex@gmail\.com>\r\n/);
    assert.match(decoded, /\r\nTo: client@acme\.com\r\n/);
    assert.match(decoded, /\r\nReply-To: billing@rivera\.studio\r\n/);
    assert.match(decoded, /\r\nSubject: =\?UTF-8\?B\?/);
    assert.match(decoded, /\r\nContent-Transfer-Encoding: base64\r\n/);
    const [, bodyB64] = decoded.split("\r\n\r\n");
    const decodedBody = Buffer.from(bodyB64.replace(/\r\n/g, ""), "base64").toString("utf8");
    assert.equal(decodedBody, "Hello Maya,\r\n\r\nPlease settle invoice INV-1044.");
  });

  it("omits Reply-To when identical to From", () => {
    const raw = buildRawMimeMessage({
      fromEmail: "alex@gmail.com",
      replyTo: "ALEX@GMAIL.COM",
      to: "client@acme.com",
      subject: "Checking in on invoice INV-1",
      body: "Hi there.",
    });
    const decoded = decodeBase64Url(raw);
    assert.equal(decoded.includes("Reply-To:"), false);
  });

  it("rejects invalid email addresses", () => {
    assert.throws(() =>
      buildRawMimeMessage({
        fromEmail: "alex@gmail.com",
        to: "not-an-email",
        subject: "Test",
        body: "Hello",
      }),
    );
  });
});

describe("exchangeCodeForTokens", () => {
  it("exchanges auth code and fetches user email", async () => {
    let calls = 0;
    const mockFetch: typeof fetch = async (input) => {
      calls += 1;
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "acc-1",
            refresh_token: "ref-1",
            expires_in: 3600,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ email: "alex@gmail.com" }), { status: 200 });
    };

    const res = await exchangeCodeForTokens(
      {
        code: "auth-code",
        redirectUri: "http://localhost:8080/gmail-callback",
        creds: { clientId: "cid", clientSecret: "csec" },
      },
      mockFetch,
    );
    assert.equal(calls, 2);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.tokens.email, "alex@gmail.com");
      assert.equal(res.tokens.accessToken, "acc-1");
      assert.equal(res.tokens.refreshToken, "ref-1");
    }
  });

  it("returns an actionable error if refresh_token is omitted", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ access_token: "acc-only", expires_in: 3600 }), {
        status: 200,
      });

    const res = await exchangeCodeForTokens(
      {
        code: "auth-code",
        redirectUri: "http://localhost:8080/gmail-callback",
        creds: { clientId: "cid", clientSecret: "csec" },
      },
      mockFetch,
    );
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.error, /refresh token/i);
    }
  });
});

describe("refreshAccessToken", () => {
  it("flags reconnectRequired on invalid_grant", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ error: "invalid_grant", error_description: "Token revoked" }), {
        status: 400,
      });

    const res = await refreshAccessToken(
      { refreshToken: "bad-ref", creds: { clientId: "cid", clientSecret: "csec" } },
      mockFetch,
    );
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reconnectRequired, true);
    }
  });
});

describe("sendEmailWithGmail", () => {
  it("preemptively refreshes an expired token before sending", async () => {
    const tokensSeen: string[] = [];
    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({ access_token: "fresh-access", expires_in: 3600 }),
          { status: 200 },
        );
      }
      const authHeader = (init?.headers as Record<string, string>)?.Authorization ?? "";
      tokensSeen.push(authHeader);
      return new Response(JSON.stringify({ id: "msg-99" }), { status: 200 });
    };

    const res = await sendEmailWithGmail(
      {
        accessToken: "stale-access",
        refreshToken: "ref-1",
        expiresAt: Date.now() - 10_000,
        fromEmail: "alex@gmail.com",
        to: "client@acme.com",
        subject: "Invoice INV-1",
        body: "Hello",
        creds: { clientId: "cid", clientSecret: "csec" },
      },
      mockFetch,
    );

    assert.equal(res.ok, true);
    assert.deepEqual(tokensSeen, ["Bearer fresh-access"]);
    if (res.ok) {
      assert.equal(res.messageId, "msg-99");
      assert.equal(res.refreshedToken?.accessToken, "fresh-access");
    }
  });

  it("retries once after a 401 by refreshing the token", async () => {
    let sendAttempt = 0;
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({ access_token: "recovered-access", expires_in: 3600 }),
          { status: 200 },
        );
      }
      sendAttempt += 1;
      if (sendAttempt === 1) {
        return new Response(JSON.stringify({ error: { message: "Invalid Credentials" } }), {
          status: 401,
        });
      }
      return new Response(JSON.stringify({ id: "msg-retry" }), { status: 200 });
    };

    const res = await sendEmailWithGmail(
      {
        accessToken: "bad-access",
        refreshToken: "ref-1",
        expiresAt: Date.now() + 600_000,
        fromEmail: "alex@gmail.com",
        to: "client@acme.com",
        subject: "Invoice INV-1",
        body: "Hello",
        creds: { clientId: "cid", clientSecret: "csec" },
      },
      mockFetch,
    );

    assert.equal(sendAttempt, 2);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.messageId, "msg-retry");
      assert.equal(res.refreshedToken?.accessToken, "recovered-access");
    }
  });
});
