import { create } from "zustand";
import { persist } from "zustand/middleware";
import { makeSamples } from "./samples";
import type {
  AutoSendError,
  GmailAutoSettings,
  GmailOAuthConfig,
  GmailTokens,
  Matter,
  Profile,
  SendMethod,
  StageId,
} from "./types";

export const emptyProfile: Profile = { name: "", business: "", email: "" };
export const defaultAutoSendSettings: GmailAutoSettings = {
  autoSendOnCreate: true,
  autoSendDueFollowups: true,
};

interface SendMeta {
  method?: SendMethod;
  to?: string;
  messageId?: string;
}

interface DunnState {
  matters: Matter[];
  profile: Profile;
  gmailTokens: GmailTokens | null;
  gmailOAuthConfig: GmailOAuthConfig | null;
  autoSendSettings: GmailAutoSettings;
  initialized: boolean;
  hydrated: boolean;
  setHydrated: () => void;
  upsert: (matter: Matter) => void;
  remove: (id: string) => void;
  markSent: (id: string, stage: StageId, meta?: SendMeta) => void;
  markInvoiceSent: (id: string, meta?: SendMeta) => void;
  markPaid: (id: string) => void;
  writeOff: (id: string) => void;
  reopen: (id: string) => void;
  saveAiLetter: (id: string, stage: StageId, subject: string, body: string) => void;
  setProfile: (patch: Partial<Profile>) => void;
  setGmailTokens: (tokens: GmailTokens | null) => void;
  updateGmailAccessToken: (accessToken: string, expiresAt: number, refreshToken?: string) => void;
  disconnectGmail: () => void;
  setGmailOAuthConfig: (config: GmailOAuthConfig | null) => void;
  setAutoSendSettings: (patch: Partial<GmailAutoSettings>) => void;
  setMatterAutoSend: (id: string, autoSend: boolean) => void;
  updateMatterClientEmail: (id: string, clientEmail: string) => void;
  setMatterAutoError: (id: string, error: AutoSendError | undefined) => void;
  seedIfEmpty: () => void;
}

export const useDunn = create<DunnState>()(
  persist(
    (set, get) => ({
      matters: [],
      profile: emptyProfile,
      gmailTokens: null,
      gmailOAuthConfig: null,
      autoSendSettings: defaultAutoSendSettings,
      initialized: false,
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      upsert: (matter) =>
        set((s) => {
          const i = s.matters.findIndex((m) => m.id === matter.id);
          const matters = [...s.matters];
          if (i >= 0) matters[i] = matter;
          else matters.unshift(matter);
          return { matters };
        }),
      remove: (id) => set((s) => ({ matters: s.matters.filter((m) => m.id !== id) })),
      markSent: (id, stage, meta) =>
        set((s) => ({
          matters: s.matters.map((m) => {
            if (m.id !== id) return m;
            const sentLog = m.sentLog.filter((x) => x.stage !== stage);
            sentLog.push({
              stage,
              sentAt: new Date().toISOString(),
              method: meta?.method ?? "manual",
              ...(meta?.to ? { to: meta.to } : {}),
              ...(meta?.messageId ? { messageId: meta.messageId } : {}),
            });
            return {
              ...m,
              sentLog,
              ...(m.lastAutoError?.key === String(stage) ? { lastAutoError: undefined } : {}),
            };
          }),
        })),
      markInvoiceSent: (id, meta) =>
        set((s) => ({
          matters: s.matters.map((m) =>
            m.id === id
              ? {
                  ...m,
                  invoiceSentAt: new Date().toISOString(),
                  invoiceSentMethod: meta?.method ?? "manual",
                  ...(meta?.to ? { invoiceSentTo: meta.to } : {}),
                  ...(meta?.messageId ? { invoiceMessageId: meta.messageId } : {}),
                  ...(m.lastAutoError?.key === "invoice" ? { lastAutoError: undefined } : {}),
                }
              : m,
          ),
        })),
      markPaid: (id) =>
        set((s) => ({
          matters: s.matters.map((m) =>
            m.id === id ? { ...m, markedPaidAt: new Date().toISOString(), writtenOffAt: undefined } : m,
          ),
        })),
      writeOff: (id) =>
        set((s) => ({
          matters: s.matters.map((m) =>
            m.id === id ? { ...m, writtenOffAt: new Date().toISOString() } : m,
          ),
        })),
      reopen: (id) =>
        set((s) => ({
          matters: s.matters.map((m) =>
            m.id === id ? { ...m, markedPaidAt: undefined, writtenOffAt: undefined } : m,
          ),
        })),
      saveAiLetter: (id, stage, subject, body) =>
        set((s) => ({
          matters: s.matters.map((m) =>
            m.id === id
              ? { ...m, aiLetters: { ...m.aiLetters, [stage]: { subject, body } } }
              : m,
          ),
        })),
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setGmailTokens: (tokens) => set({ gmailTokens: tokens }),
      updateGmailAccessToken: (accessToken, expiresAt, refreshToken) =>
        set((s) =>
          s.gmailTokens
            ? {
                gmailTokens: {
                  ...s.gmailTokens,
                  accessToken,
                  expiresAt,
                  ...(refreshToken ? { refreshToken } : {}),
                },
              }
            : {},
        ),
      disconnectGmail: () => set({ gmailTokens: null }),
      setGmailOAuthConfig: (config) => set({ gmailOAuthConfig: config }),
      setAutoSendSettings: (patch) =>
        set((s) => ({ autoSendSettings: { ...s.autoSendSettings, ...patch } })),
      setMatterAutoSend: (id, autoSend) =>
        set((s) => ({
          matters: s.matters.map((m) =>
            m.id === id && !m.isSample ? { ...m, autoSend } : m,
          ),
        })),
      updateMatterClientEmail: (id, clientEmail) =>
        set((s) => ({
          matters: s.matters.map((m) =>
            m.id === id
              ? { ...m, clientEmail: clientEmail.trim(), lastAutoError: undefined }
              : m,
          ),
        })),
      setMatterAutoError: (id, error) =>
        set((s) => ({
          matters: s.matters.map((m) => (m.id === id ? { ...m, lastAutoError: error } : m)),
        })),
      seedIfEmpty: () => {
        const s = get();
        if (s.initialized) return;
        set({
          initialized: true,
          matters: s.matters.length ? s.matters : makeSamples(),
        });
      },
    }),
    {
      name: "dunn-desk-v1",
      skipHydration: true,
      partialize: (s) => ({
        matters: s.matters,
        profile: s.profile,
        gmailTokens: s.gmailTokens,
        gmailOAuthConfig: s.gmailOAuthConfig,
        autoSendSettings: s.autoSendSettings,
        initialized: s.initialized,
      }),
    },
  ),
);
