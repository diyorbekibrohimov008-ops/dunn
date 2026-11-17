export type Relationship = "friendly" | "neutral" | "strained";
export type Currency = "USD" | "EUR" | "GBP" | "CAD" | "AUD";

export type StageId = 1 | 2 | 3 | 4 | 5;

export type SendMethod = "manual" | "gmail" | "gmail-auto";

export interface SentLog {
  stage: StageId;
  sentAt: string;
  method?: SendMethod;
  to?: string;
  messageId?: string;
}

export interface AutoSendError {
  key: string;
  at: string;
  message: string;
}

export interface Matter {
  id: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  amount: number;
  currency: Currency;
  invoiceNumber: string;
  issuedOn: string;
  dueOn: string;
  workDescription: string;
  relationship: Relationship;
  yourName: string;
  yourBusiness: string;
  yourEmail: string;
  termsNote: string;
  createdAt: string;
  sentLog: SentLog[];
  aiLetters: Partial<Record<StageId, { subject: string; body: string }>>;
  markedPaidAt?: string;
  writtenOffAt?: string;
  isSample?: boolean;
  autoSend?: boolean;
  invoiceSentAt?: string;
  invoiceSentTo?: string;
  invoiceSentMethod?: SendMethod;
  invoiceMessageId?: string;
  lastAutoError?: AutoSendError;
}

export interface Profile {
  name: string;
  business: string;
  email: string;
}

export interface StageMeta {
  id: StageId;
  name: string;
  short: string;
  when: string;
  typicalDay: number;
}

export interface Letter {
  subject: string;
  body: string;
}

export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
  connectedAt?: string;
}

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface GmailAutoSettings {
  autoSendOnCreate: boolean;
  autoSendDueFollowups: boolean;
}
