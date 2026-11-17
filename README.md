# SH Enterprise (Green Energy) — Solar Customer App

Real website + Firebase backend for a PM Surya Ghar rooftop-solar vendor
in Goalpara, Assam. Vendor: Saiful — SH Enterprise (Saiful Hawk Enterprise)
aka Green Energy, Kalpanagar, near Kalpana Cinema Hall, Goalpara.

**Live site:** https://amtic50.github.io/sh-enterprise-solar/

## Architecture

- **Frontend:** this public repo, served by GitHub Pages. It contains
  **no customer data, ever** — only code and 8 clearly-marked sample
  customers for the logged-out preview.
- **Backend:** Firebase — Authentication (vendor login, email/password)
  + Cloud Firestore (all real data). Config lives in
  `firebase-config.js` (filled in by the project owner).
- **Photos/documents:** Google Drive (via Apps Script, like the other
  apps) — Firebase is login + data only.

## What it does

- **Vendor login** — email + password. Logged-out visitors see only a
  small clearly-marked **sample preview** (8 sample customers). After
  login, sample data disappears and only real Firestore data shows.
- **Customers as cards** — name, consumer number, system kW, status pill,
  applied date, area. One tap opens the detail with WhatsApp + SMS
  buttons (prefilled bilingual English + Assamese personalised message).
  Sort by applied date / install date, filters for stage, sub-division,
  capacity, plus search.
- **Needs action (dashboard)** — the stuck portal stages with counts and
  a one-tap bilingual reminder per customer: Subsidy Request (Not
  Redeemed), Subsidy Request (Return), Installation (Pending), Upload
  Agreement (Pending), Inspection (Pending), Subsidy Disbursal (Pending).
  Disbursed customers are the referral/offer audience.
- **Make a quote** — fill system size and costs; the quotation builds
  itself with GST (default 13.8%, editable), PM Surya Ghar subsidy
  (1 kW ₹30,000 · 2 kW ₹60,000 · 3 kW+ ₹78,000) and net payable.
  Print / Save as PDF, or copy the quote for WhatsApp.
- **Rewards** — tiered rewards (1 / 2 / 3+ referrals), settable in
  Settings; reward-due flags; per-customer custom rewards.
- **Customer reward link** — `?c=<code>` shows that customer's referral
  count, tier progress and rewards earned. No login for customers.
- **Referrals** — every customer has a refer code (SH + 4 characters)
  printed in their messages and on their reward page, with a Share on
  WhatsApp button; a public referral form collects the referrer's consumer
  number, mobile and address plus the friend's name, mobile and address.
  The vendor confirms each referral in the app, and the reward is earned
  only when the friend actually gets solar.
- **Sent tracking** — every WhatsApp / SMS / Copy tap is recorded per
  customer, so the vendor can see who a message was already sent to.
- **Festival messages** — one festival template with an occasion picker
  (Christmas, New Year, Bihu, Eid, Holi and more); only the occasion
  changes.
- **Personalize with AI** — the vendor's own Gemini API key (kept in
  Settings, never in the repo) rewrites a message in a warmer tone;
  the model is locked to Gemini 3.5 Flash Lite.
- **Settings (master data)** — business details, GST %, reward tiers,
  message templates (English + Assamese, plus the six reminder templates).
- **Import / Export CSV** — import accepts the PM Surya Ghar portal
  export columns exactly (Application Number, Sub Division Name,
  Consumer Number, Consumer Name, Mobile No., Proposed Capacity (kWp),
  Status, Submitted On, Reverification, Duplicate Sr. No.) or a simple
  list (consumer number, name, mobile, address, install date, system kW,
  referred by). The portal export has **no address and no install date**
  — those are optional fields added later on the customer page.

## Firestore structure

- `customers/{code}` — doc id is the random code used in the reward link.
  Fields: consumerNo, name, mobile, address, installDate, systemKw,
  applicationNo, status, submittedOn, subDivision, area, referredBy,
  referralCount, rewards[], duplicate, reverification.
- `meta/settings` — business settings, reward tiers, message templates.
- `firestore.rules` — vendor login gates all reads/writes except a
  single-document GET on a customer doc by its code (the reward link).
  List queries always need the login.

## Privacy

The 305 real customers (exported from the PM Surya Ghar portal) are
imported by the logged-in vendor through the app's CSV import and live
in Firestore only. They are never committed to this repo, and the public
demo preview shows sample customers only.

## Upgrade path (later)

- Google Drive uploads for photos/documents.
- Staff logins with limited access (admin sees all, staff see their own).
- Capacitor wraps this same site into the Android APK.
