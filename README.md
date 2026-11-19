# Dunn — Overdue Invoice Recovery & Automated Dispatch Desk

Dunn is a client communication and overdue invoice recovery desk for freelancers, contractors, and boutique agencies. It turns late-payment stress into a systematic, dignified recovery process with ready invoice dispatch and progressive follow-up notices.

> [!WARNING]
> **Project Status — Work in Progress (Not Fully Ready)**
> This project is currently under active development and is **not fully ready for production**. Some parts, features, or workflow steps will fail or behave unexpectedly. We are actively working on fixing all remaining issues.

---

## Highlights

- **Direct Gmail OAuth2 Integration:** Connect your Google account once to send invoices and notices directly from your real Gmail address (`gmail.send` + `userinfo.email`).
- **Automated Dispatch:**
  - **Auto-send on creation:** Automatically send newly drafted invoices to clients as soon as they are ready.
  - **Automated follow-ups:** Automatically queue and deliver escalating recovery notices when invoice due dates pass.
- **Progressive 4-Stage Recovery Playbook:**
  - **Stage 0 (Invoice):** Clean, polite invoice delivery with payment details and due date.
  - **Stage 1 (Gentle Reminder):** Friendly nudge assuming good faith.
  - **Stage 2 (Firm Follow-Up):** Professional reminder detailing invoice timeline and terms.
  - **Stage 3 (Formal Demand):** Structured legal notice with payment deadline.
  - **Stage 4 (Final Warning / Legal):** Final notice outlining pre-collections escalation.
- **Live Sequence Inspection:** Interactive sequence tabs per matter with delivery badges (`Auto-sent via Gmail`, `Sent via Gmail`, `Marked sent`), inline client email editing, and one-click resend/retry.
- **Built-in Safety Protections:** Sample matters and demo email domains (`.example`, `@example.com`) are strictly guarded against accidental real-world email dispatch.
- **Local-First & Private:** All matters, sender profiles, auto-send preferences, and session tokens persist in browser storage (`localStorage` / Zustand) — zero third-party database lock-in.

---

## Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start/latest) (Full-stack React 19 SSR / Nitro)
- **Routing:** [TanStack Router](https://tanstack.com/router/latest) with type-safe route trees
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) with custom typography & warm desk tokens
- **UI Components:** [Radix UI](https://www.radix-ui.com/) primitives + Lucide React icons
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) with persistence
- **Validation & Forms:** [Zod](https://zod.dev/)
- **Bundler:** [Vite](https://vite.dev/)

---

## Getting Started

### 1. Prerequisites

- **Node.js:** v22 or higher
- **npm:** v10 or higher

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/<your-username>/dunn.git
cd dunn
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### 4. Build for Production

```bash
npm run build
npm run preview
```

---

## Gmail Integration Setup

To allow Dunn to send emails through your Gmail account:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Gmail API** under **APIs & Services > Library**.
3. Configure the **OAuth Consent Screen** (User Type: External, add scopes `https://www.googleapis.com/auth/gmail.send`, `https://www.googleapis.com/auth/userinfo.email`, and `openid`).
4. Add your email address under **Test Users** while in Testing mode.
5. Create an **OAuth 2.0 Client ID** (Application type: Web application):
   - **Authorized JavaScript origins:** `http://localhost:8080` (and your deployed domain)
   - **Authorized redirect URIs:** `http://localhost:8080/gmail-callback` (and `https://<your-domain>/gmail-callback`)
6. Set the environment variables on your deployment or enter them directly inside Dunn under **Settings > Custom Google Cloud Credentials**:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret

---

## License

MIT License. Feel free to use, modify, and distribute.
