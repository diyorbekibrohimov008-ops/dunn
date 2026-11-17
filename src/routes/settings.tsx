import { createFileRoute, Link } from "@tanstack/react-router";
import { LoaderCircle, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { GmailConnect } from "@/components/gmail-connect";
import { useHasHydrated } from "@/components/hydrate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { money } from "@/lib/format";
import {
  describeTarget,
  isExampleEmail,
  isValidEmail,
  readyTargetForMatter,
  runAutoSendPass,
} from "@/lib/gmail-client";
import { openMatters } from "@/lib/recovery";
import { useDunn } from "@/lib/store";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const hydrated = useHasHydrated();
  const profile = useDunn((s) => s.profile);
  const setProfile = useDunn((s) => s.setProfile);
  const gmailTokens = useDunn((s) => s.gmailTokens);
  const matters = useDunn((s) => s.matters);
  const setMatterAutoSend = useDunn((s) => s.setMatterAutoSend);

  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [runningPass, setRunningPass] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    setName(profile.name);
    setBusiness(profile.business);
    setEmail(profile.email || gmailTokens?.email || "");
  }, [hydrated, profile.name, profile.business, profile.email, gmailTokens?.email]);

  const userOpenFiles = hydrated
    ? openMatters(matters).filter((m) => !m.isSample)
    : [];

  function saveProfile(e: FormEvent) {
    e.preventDefault();
    setProfile({
      name: name.trim(),
      business: business.trim(),
      email: email.trim(),
    });
    toast.success("Sender profile saved");
  }

  async function handleRunNow() {
    setRunningPass(true);
    try {
      const res = await runAutoSendPass({ ignorePreviousErrors: true });
      if (res.sentCount === 0 && res.errorCount === 0) {
        toast.message("No auto-send notices are due right now");
      }
    } finally {
      setRunningPass(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <p className="text-2xs tracking-kicker text-subtle uppercase">Email & automation</p>
      <h1 className="mt-2 font-serif text-4xl italic tracking-tight text-fg">Settings</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Connect Gmail once so Dunn can email ready invoices and due follow-up letters
        directly from your inbox.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <GmailConnect />

        <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl italic text-fg">Auto-send files</h2>
              <p className="mt-1 text-sm text-muted">
                Your open files eligible for automatic Gmail follow-ups. Sample files stay
                manual.
              </p>
            </div>
            <Button
              variant="outline"
              disabled={!hydrated || !gmailTokens || runningPass}
              onClick={() => void handleRunNow()}
            >
              {runningPass ? <LoaderCircle className="animate-spin" /> : <Send />}
              {runningPass ? "Checking…" : "Check & send due now"}
            </Button>
          </div>

          {!hydrated ? (
            <div className="mt-5 h-20 rounded-lg border border-border bg-elevated" />
          ) : userOpenFiles.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-border px-4 py-6 text-center">
              <p className="text-sm text-muted">
                No personal open files yet. Create an invoice file to enable automatic sending.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to="/new">Open a file</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-border rounded-lg border border-border bg-bg/40">
              {userOpenFiles.map((m) => {
                const target = readyTargetForMatter(m);
                const validRecipient = isValidEmail(m.clientEmail) && !isExampleEmail(m.clientEmail);
                return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/file/$fileId"
                          params={{ fileId: m.id }}
                          className="truncate font-medium text-fg hover:underline"
                        >
                          {m.clientCompany || m.clientName} · {m.invoiceNumber}
                        </Link>
                        <span className="font-mono text-xs text-muted">
                          {money(m.amount, m.currency)}
                        </span>
                        {target ? (
                          <Badge tone="paper">Ready: {describeTarget(target)}</Badge>
                        ) : (
                          <Badge tone="muted">Up to date</Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted">
                        {validRecipient
                          ? `To: ${m.clientEmail}`
                          : "Missing real client email — add one on the file to auto-send"}
                      </p>
                      {m.lastAutoError ? (
                        <p className="mt-1 text-xs text-danger">
                          Last error: {m.lastAutoError.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted">Auto-send</span>
                      <Switch
                        aria-label={`Auto-send for ${m.invoiceNumber}`}
                        checked={Boolean(m.autoSend)}
                        disabled={!validRecipient}
                        onCheckedChange={(checked) => setMatterAutoSend(m.id, checked)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="font-serif text-2xl italic text-fg">Default sender profile</h2>
          <p className="mt-1 text-sm text-muted">
            Used to sign new invoices and letters automatically.
          </p>
          <form onSubmit={saveProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="profile-name">Your name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-business">Business</Label>
              <Input
                id="profile-business"
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                placeholder="Rivera Studio"
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="profile-email">Reply-to email</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@rivera.studio"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="outline">
                Save profile
              </Button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
