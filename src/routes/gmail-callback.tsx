import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GMAIL_OAUTH_STATE_KEY } from "@/components/gmail-connect";
import { useHasHydrated } from "@/components/hydrate";
import { Button } from "@/components/ui/button";
import { exchangeGmailCode } from "@/lib/gmail";
import { useDunn } from "@/lib/store";

export const Route = createFileRoute("/gmail-callback")({
  component: GmailCallbackPage,
});

type CallbackState =
  | { status: "loading" }
  | { status: "success"; email: string }
  | { status: "error"; message: string };

function GmailCallbackPage() {
  const hydrated = useHasHydrated();
  const gmailOAuthConfig = useDunn((s) => s.gmailOAuthConfig);
  const profileEmail = useDunn((s) => s.profile.email);
  const setGmailTokens = useDunn((s) => s.setGmailTokens);
  const setProfile = useDunn((s) => s.setProfile);

  const [result, setResult] = useState<CallbackState>({ status: "loading" });
  const startedRef = useRef(false);

  useEffect(() => {
    if (!hydrated || startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    const code = params.get("code");
    const returnedState = params.get("state");
    const expectedState = window.sessionStorage.getItem(GMAIL_OAUTH_STATE_KEY);
    window.sessionStorage.removeItem(GMAIL_OAUTH_STATE_KEY);

    if (oauthError) {
      setResult({
        status: "error",
        message:
          oauthError === "access_denied"
            ? "Gmail authorization was cancelled."
            : `Google returned an authorization error: ${oauthError}`,
      });
      return;
    }

    if (!code) {
      setResult({
        status: "error",
        message: "Missing authorization code from Google.",
      });
      return;
    }

    if (!expectedState || returnedState !== expectedState) {
      setResult({
        status: "error",
        message: "OAuth session state did not match. Please start the Gmail connection again.",
      });
      return;
    }

    const redirectUri = `${window.location.origin}/gmail-callback`;

    void exchangeGmailCode({
      data: {
        code,
        redirectUri,
        customConfig: gmailOAuthConfig,
      },
    })
      .then((res) => {
        if (!res.ok) {
          setResult({ status: "error", message: res.error });
          return;
        }
        setGmailTokens(res.tokens);
        if (!profileEmail.trim()) {
          setProfile({ email: res.tokens.email });
        }
        setResult({ status: "success", email: res.tokens.email });
      })
      .catch(() => {
        setResult({
          status: "error",
          message: "Could not complete the Gmail token exchange. Please try again.",
        });
      });
  }, [hydrated, gmailOAuthConfig, profileEmail, setGmailTokens, setProfile]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
        {result.status === "loading" ? (
          <div className="flex flex-col items-start gap-3">
            <LoaderCircle className="size-6 animate-spin text-primary" />
            <h1 className="font-serif text-3xl italic text-fg">Connecting Gmail…</h1>
            <p className="text-sm text-muted">
              Verifying authorization with Google and storing your sending token in this
              browser.
            </p>
          </div>
        ) : result.status === "success" ? (
          <div className="flex flex-col items-start gap-4">
            <CheckCircle2 className="size-6 text-ok" />
            <div>
              <p className="text-2xs tracking-kicker text-subtle uppercase">Gmail ready</p>
              <h1 className="mt-1 font-serif text-3xl italic text-fg">Connected to Gmail</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Dunn can now send invoices and follow-up notices automatically from{" "}
                <span className="font-mono text-fg">{result.email}</span>.
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/new">Open a file</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/desk">Go to desk</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/settings">Settings</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <AlertCircle className="size-6 text-danger" />
            <div>
              <p className="text-2xs tracking-kicker text-subtle uppercase">Connection error</p>
              <h1 className="mt-1 font-serif text-3xl italic text-fg">Could not connect Gmail</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">{result.message}</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/settings">Back to settings</Link>
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
