import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  LoaderCircle,
  Mail,
  Unplug,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useHasHydrated } from "@/components/hydrate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getGmailAuthUrl, getGmailConfigStatus } from "@/lib/gmail";
import { useDunn } from "@/lib/store";

export const GMAIL_OAUTH_STATE_KEY = "dunn-gmail-oauth-state";

export function GmailConnect() {
  const hydrated = useHasHydrated();
  const gmailTokens = useDunn((s) => s.gmailTokens);
  const gmailOAuthConfig = useDunn((s) => s.gmailOAuthConfig);
  const autoSendSettings = useDunn((s) => s.autoSendSettings);
  const setGmailOAuthConfig = useDunn((s) => s.setGmailOAuthConfig);
  const setAutoSendSettings = useDunn((s) => s.setAutoSendSettings);
  const disconnectGmail = useDunn((s) => s.disconnectGmail);

  const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);
  const [clientIdPreview, setClientIdPreview] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  const [clientIdInput, setClientIdInput] = useState("");
  const [clientSecretInput, setClientSecretInput] = useState("");

  const redirectUri =
    typeof window !== "undefined" ? `${window.location.origin}/gmail-callback` : "";

  useEffect(() => {
    let cancelled = false;
    void getGmailConfigStatus()
      .then((res) => {
        if (cancelled) return;
        setServerConfigured(res.serverConfigured);
        setClientIdPreview(res.clientIdPreview);
        if (!res.serverConfigured && !gmailOAuthConfig?.clientId) {
          setShowSetup(true);
        }
      })
      .catch(() => {
        if (!cancelled) setServerConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gmailOAuthConfig?.clientId]);

  useEffect(() => {
    if (!hydrated) return;
    if (gmailOAuthConfig) {
      setClientIdInput(gmailOAuthConfig.clientId);
      setClientSecretInput(gmailOAuthConfig.clientSecret);
    }
  }, [hydrated, gmailOAuthConfig]);

  const hasCredentials =
    Boolean(serverConfigured) ||
    Boolean(gmailOAuthConfig?.clientId && gmailOAuthConfig?.clientSecret);

  async function handleConnect() {
    if (typeof window === "undefined") return;
    setConnecting(true);
    try {
      const stateBytes = new Uint8Array(24);
      crypto.getRandomValues(stateBytes);
      const state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, "0")).join("");
      window.sessionStorage.setItem(GMAIL_OAUTH_STATE_KEY, state);

      const res = await getGmailAuthUrl({
        data: {
          redirectUri: `${window.location.origin}/gmail-callback`,
          state,
          customConfig: gmailOAuthConfig,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        setShowSetup(true);
        setConnecting(false);
        return;
      }
      window.location.assign(res.url);
    } catch {
      toast.error("Could not start Gmail authorization. Try again.");
      setConnecting(false);
    }
  }

  function handleSaveCredentials() {
    const id = clientIdInput.trim();
    const secret = clientSecretInput.trim();
    if (!id || !secret) {
      toast.error("Enter both the Google Client ID and Client Secret.");
      return;
    }
    setGmailOAuthConfig({ clientId: id, clientSecret: secret });
    toast.success("Google OAuth credentials saved");
  }

  function handleClearCredentials() {
    setGmailOAuthConfig(null);
    setClientIdInput("");
    setClientSecretInput("");
    toast.message("Saved OAuth credentials cleared");
  }

  async function copyRedirectUri() {
    if (!redirectUri) return;
    await navigator.clipboard.writeText(redirectUri);
    setCopiedUri(true);
    toast.success("Redirect URI copied");
    window.setTimeout(() => setCopiedUri(false), 1500);
  }

  const connected = hydrated && Boolean(gmailTokens);

  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-serif text-2xl italic text-fg">Gmail connection</h2>
            {hydrated ? (
              <Badge tone={connected ? "ok" : "muted"}>
                {connected ? "Connected" : "Not connected"}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Connect your Gmail once. When a new invoice or recovery notice is ready, Dunn
            emails the client directly from your address and logs it on the file.
          </p>
        </div>

        {connected && gmailTokens ? (
          <Button
            variant="outline"
            onClick={() => {
              disconnectGmail();
              toast.message("Gmail disconnected");
            }}
          >
            <Unplug />
            Disconnect
          </Button>
        ) : (
          <Button
            onClick={() => void handleConnect()}
            disabled={!hydrated || connecting || !hasCredentials}
          >
            {connecting ? <LoaderCircle className="animate-spin" /> : <Mail />}
            {connecting ? "Redirecting…" : "Connect Gmail"}
          </Button>
        )}
      </div>

      {connected && gmailTokens ? (
        <div className="mt-5 rounded-lg border border-border bg-elevated px-4 py-3.5">
          <p className="text-2xs tracking-wide text-subtle uppercase">Sending from</p>
          <p className="mt-1 truncate font-mono text-sm text-fg">{gmailTokens.email}</p>
          <p className="mt-1 text-xs text-muted">
            Scope granted: <span className="font-mono text-fg">gmail.send</span> — Dunn can
            only send emails you approve or automate, never read your inbox.
          </p>
        </div>
      ) : null}

      <div className="mt-6 space-y-4 border-t border-border pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="auto-send-create" className="text-sm font-medium text-fg">
              Auto-send when a new file is ready
            </Label>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Immediately email the invoice or recommended overdue notice via Gmail as soon as
              you create a new file with a client email.
            </p>
          </div>
          <Switch
            id="auto-send-create"
            checked={autoSendSettings.autoSendOnCreate}
            onCheckedChange={(checked) => setAutoSendSettings({ autoSendOnCreate: checked })}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="auto-send-followups" className="text-sm font-medium text-fg">
              Auto-send due follow-ups when Dunn opens
            </Label>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              For your open files with Auto-send enabled, automatically send the next stage
              when its due date arrives. Sample files are never auto-sent.
            </p>
          </div>
          <Switch
            id="auto-send-followups"
            checked={autoSendSettings.autoSendDueFollowups}
            onCheckedChange={(checked) => setAutoSendSettings({ autoSendDueFollowups: checked })}
          />
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setShowSetup((v) => !v)}
          className="flex w-full items-center justify-between py-2 text-left text-sm text-muted transition-colors hover:text-fg"
        >
          <span>
            Google Cloud OAuth setup
            {serverConfigured ? (
              <span className="ml-2 font-mono text-xs text-ok">
                server configured ({clientIdPreview})
              </span>
            ) : gmailOAuthConfig?.clientId ? (
              <span className="ml-2 font-mono text-xs text-ok">credentials saved</span>
            ) : (
              <span className="ml-2 font-mono text-xs text-warn">setup required</span>
            )}
          </span>
          {showSetup ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {showSetup ? (
          <div className="mt-3 space-y-4 rounded-lg border border-border bg-bg/60 p-4 text-xs leading-relaxed text-muted">
            <ol className="list-decimal space-y-1.5 pl-4">
              <li>
                In Google Cloud Console, enable the <span className="text-fg">Gmail API</span>.
              </li>
              <li>
                Configure the OAuth consent screen (External, add your Gmail as a Test User while
                in testing) and add scope <span className="font-mono text-fg">gmail.send</span>.
              </li>
              <li>
                Create an <span className="text-fg">OAuth 2.0 Client ID</span> (Web application)
                and add this Authorized Redirect URI:
              </li>
            </ol>

            {redirectUri ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-elevated px-3 py-2">
                <code className="min-w-0 flex-1 break-all font-mono text-xs text-fg">
                  {redirectUri}
                </code>
                <Button size="sm" variant="outline" onClick={() => void copyRedirectUri()}>
                  {copiedUri ? <Check /> : <Copy />}
                  {copiedUri ? "Copied" : "Copy"}
                </Button>
              </div>
            ) : null}

            {!serverConfigured ? (
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-fg">
                  Set <code className="font-mono">GOOGLE_CLIENT_ID</code> and{" "}
                  <code className="font-mono">GOOGLE_CLIENT_SECRET</code> in your server
                  environment, or paste them here for this browser:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="google-client-id">Google Client ID</Label>
                    <Input
                      id="google-client-id"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                      placeholder="1234567890-abc.apps.googleusercontent.com"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="google-client-secret">Google Client Secret</Label>
                    <Input
                      id="google-client-secret"
                      type="password"
                      value={clientSecretInput}
                      onChange={(e) => setClientSecretInput(e.target.value)}
                      placeholder="GOCSPX-…"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleSaveCredentials}>
                    Save credentials
                  </Button>
                  {gmailOAuthConfig ? (
                    <Button size="sm" variant="ghost" onClick={handleClearCredentials}>
                      Clear saved
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-ok">
                Server environment credentials are configured. You can connect Gmail directly
                above.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
