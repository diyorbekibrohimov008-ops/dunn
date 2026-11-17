import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AutoSendRunner } from "@/lib/gmail-client";
import { useDunn } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HydrateDunn, useHasHydrated } from "./hydrate";

const LINKS = [
  { to: "/desk", label: "Desk" },
  { to: "/new", label: "New file" },
  { to: "/tools", label: "Tools" },
  { to: "/playbook", label: "Playbook" },
  { to: "/settings", label: "Settings" },
] as const;

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hydrated = useHasHydrated();
  const gmailConnected = useDunn((s) => Boolean(s.gmailTokens));

  return (
    <div className="min-h-dvh flex flex-col">
      <HydrateDunn />
      <AutoSendRunner />
      <header className="no-print sticky top-0 z-40 border-b border-border/80 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-serif text-2xl italic tracking-tight text-fg">Dunn</span>
            <span className="hidden text-2xs uppercase tracking-kicker text-subtle sm:inline">
              Recovery desk
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {LINKS.map((l) => {
              const active = pathname === l.to || (l.to !== "/desk" && pathname.startsWith(l.to));
              const deskActive =
                l.to === "/desk" && (pathname === "/desk" || pathname.startsWith("/file"));
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs transition-colors duration-150 sm:px-3 sm:text-sm",
                    active || deskActive ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {l.label}
                  {l.to === "/settings" && hydrated ? (
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        gmailConnected ? "bg-ok" : "bg-subtle",
                      )}
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="no-print border-t border-border/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Not a collection agency. Not legal advice. A desk for people who already did the work.</p>
          <p className="font-serif italic text-muted">Dunn</p>
        </div>
      </footer>
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#1c1c19",
            border: "1px solid #2a2925",
            color: "#eceae3",
          },
        }}
      />
    </div>
  );
}
