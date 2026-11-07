# AquaPlus Service OS — Documentation & Production Deployment Guide

**AquaPlus Service OS** is the internal service-management and automated customer reminder platform built specifically for **Aqua Plus RO Tech** in **Madurai, Tamil Nadu, India**.

* **Business Address:** Thirunagar 5th Stop, Madurai-625006
* **Primary Business Phone:** +91 70103 29920
* **Secondary Business Phone:** +91 63857 86516
* **Business Email:** aquaplusrosales@gmail.com
* **Website:** [https://www.aquaplusrotech.shop/](https://www.aquaplusrotech.shop/)
* **Timezone:** `Asia/Kolkata` (IST)
* **Currency:** INR (₹)
* **Date Display Format:** `DD MMM YYYY` (e.g., 14 Oct 2026)

---

## 1. System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               AquaPlus Service OS (Frontend)           │
                    │   React 19 + TypeScript + Tailwind CSS (Vite Bundler)  │
                    └───────────────▲────────────────────────▲───────────────┘
                                    │                        │
       Firestore ABAC Protected     │                        │ /api/* Server Endpoints
       Direct SDK Listeners         │                        │
                                    ▼                        ▼
                      ┌─────────────────────────┐  ┌─────────────────────────┐
                      │    Firebase Firestore   │  │   Express / Cloud Run    │
                      │  - Customers            │  │  - WhatsApp Adapter     │
                      │  - Service Records      │  │  - Email Report Adapter │
                      │  - Reminders Queue      │  │  - Owner-verified APIs  │
                      │  - Message Attempts     │  │  - API Diagnostics      │
                      │  - Business Settings    │  │  - API Health Check    │
                      │  - Audit Logs           │              │
                      └─────────────────────────┘              │
                                    ▲                          │
                                    │                          │
                      ┌─────────────┴───────────┐              │
                      │ Firebase Authentication │              │
                      │   (Google Sign-In)      │              │
                      │   Owner-Only Access     │              │
                      └─────────────────────────┘              │
                                                               │
                          ┌────────────────────────────────────┴────────────────────────────────────┐
                          ▼                                                                         ▼
            ┌───────────────────────────┐                                             ┌───────────────────────────┐
            │ Meta WhatsApp Business    │                                             │   Owner Daily Digest      │
            │   Platform Cloud API      │                                             │   (aquaplusrosales@...)   │
            │ (Graph API v25.0 Message) │                                             │   (Resend REST API)       │
            └───────────────────────────┘                                             └───────────────────────────┘
```

---

## 2. Unfinished Configuration Steps (Action Checklist for Owner)

| Item | Service | Environment Variable | Status |
| :--- | :--- | :--- | :--- |
| 1 | **Meta WhatsApp Cloud API credentials and approved template** | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_TEMPLATE_NAME` | ⚠️ Owner setup required |
| 2 | **Resend account, verified sender domain, and API key** | `RESEND_API_KEY`, `EMAIL_FROM` | ⚠️ Owner setup required |
| 3 | **Firebase Admin project/database and owner allowlist** | `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `OWNER_EMAILS` | ⚠️ Set in server configuration |
| 4 | **Production hosting and domain** | `APP_URL`, `PORT` | Docker/Express scaffold added; deployment still required |
| 5 | **Firestore-backed scheduler and durable idempotency** | Firebase Admin, `SCHEDULER_OWNER_UID`, `SCHEDULER_BEARER_TOKEN` | API added; Cloud Run IAM and Cloud Scheduler job still need setup |
| 6 | **Backups, monitoring, incident recovery, and data retention policy** | Firebase/Cloud Run operations | ⚠️ Owner setup required |
| 7 | **WhatsApp delivery receipts and opt-out handling** | `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Implemented; owner must configure the public webhook URL and Meta subscriptions |
| 8 | **Restricted WhatsApp test recipient** | `WHATSAPP_TEST_RECIPIENT` | Required to enable the live test endpoint |

> **Delivery semantics:** Integration status reports whether credentials are present; it does not test connectivity. A successful Meta response means **accepted by Meta**, not delivered. Delivery and read confirmation appear only after a verified webhook event. The direct cloud-send route checks consent and current service cycle and uses the same idempotency reservation. The live test endpoint is limited to `WHATSAPP_TEST_RECIPIENT`.

---

## 3. Environment Variables Reference (`.env`)

Use `.env.example` as the variable checklist. Put provider and scheduler secrets in the hosting secret manager, never in frontend build variables. The Admin SDK verifies Firebase ID tokens and restricts API access to verified owner emails. Attach a Cloud Run service account with Firestore access; do not download a service-account key into the app.

```env
# Firebase Admin SDK / database
FIREBASE_PROJECT_ID="positive-drake-n4mm2"
FIRESTORE_DATABASE_ID="ai-studio-4b6f33c0-20b1-4c18-b179-368ff6878ffb"
OWNER_EMAILS="nisanth.t9c@gmail.com,aquaplusrosales@gmail.com,vishaalchinnan@gmail.com"
SCHEDULER_OWNER_UID="YOUR_FIREBASE_OWNER_UID"
SCHEDULER_BEARER_TOKEN="GENERATE_A_LONG_RANDOM_SECRET"

# Meta WhatsApp Business Platform Cloud API
WHATSAPP_ACCESS_TOKEN="EAA..."
WHATSAPP_PHONE_NUMBER_ID="109876543210987"
WHATSAPP_BUSINESS_ACCOUNT_ID="123456789012345"
WHATSAPP_TEMPLATE_NAME="service_maintenance_reminder"
WHATSAPP_GRAPH_API_VERSION="v25.0"
WHATSAPP_APP_SECRET="YOUR_META_APP_SECRET"
WHATSAPP_WEBHOOK_VERIFY_TOKEN="GENERATE_A_LONG_RANDOM_WEBHOOK_TOKEN"
WHATSAPP_TEST_RECIPIENT="+91XXXXXXXXXX"

# Owner Daily Digest Email Delivery (Resend)
RESEND_API_KEY="re_..."
EMAIL_FROM="Aqua Plus RO Tech <reports@your-verified-domain.com>"
```

### Production container

Build and run the Docker container to serve the Vite frontend and the Express API:

```bash
docker build -t aquaplus-service-os .
docker run --rm -p 8080:8080 --env-file .env aquaplus-service-os
```

Deploy the same image to Cloud Run and configure server variables with Secret Manager. Attach a service account with `roles/datastore.user` and read-only `roles/firebaseauth.viewer` on the Firebase project: Firestore Admin reads/writes business data, while token revocation and scheduler-owner checks read Auth users. Add the production hostname to Firebase Authentication's authorized domains and deploy the rules to the configured named database with `firebase deploy --project positive-drake-n4mm2 --only firestore:ai-studio-4b6f33c0-20b1-4c18-b179-368ff6878ffb` before inviting owners. Confirm this is the production Firebase project before deploying.

---

## 4. Meta WhatsApp Business Cloud API Setup Instructions

1. Go to [Meta for Developers](https://developers.facebook.com/) and register or log in.
2. Create an App with type **Business**.
3. Under Add Products, select **WhatsApp**.
4. Link your WhatsApp Business Account (WABA) and add your phone number `+91 70103 29920`.
5. Under **Message Templates**, create a template named `service_maintenance_reminder` (Category: Utility).
   - **Language:** English (`en`) and Tamil (`ta`).
   - **Body text:**
     `Hello {{1}}, this is Aqua Plus RO Tech, Madurai. Our records show that your RO purifier was last serviced on {{2}}. Your scheduled maintenance reminder is due. Would you like to arrange a service visit? Contact us at {{3}}. Thank you for choosing Aqua Plus RO Tech.`
6. Generate a **System User Permanent Access Token** in Meta Business Manager and grant `whatsapp_business_messaging`.
7. Paste `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` into your production environment.
8. Configure Meta's callback URL as `https://<your-app-domain>/api/webhooks/whatsapp`, use the exact `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, and subscribe to the WhatsApp `messages` field. Set `WHATSAPP_APP_SECRET` to the Meta app secret. The server verifies `X-Hub-Signature-256` against the untouched raw body using HMAC-SHA256; missing or invalid signatures are rejected. Keep both values in the server secret manager.

Inbound `STOP`, `UNSUBSCRIBE`, `CANCEL`, and supported Tamil opt-out phrases turn off recorded WhatsApp consent. A number matching multiple customer records is recorded as ambiguous and changes no customer. Opt-out consent is not restored by unrelated inbound messages.

---

## 5. Daily Scheduled Processing & Cloud Scheduler Setup

The production server now reads and writes the batch through Firebase Admin, and `POST /api/scheduler/run` is available to an authorized signed-in owner. For unattended runs, set `SCHEDULER_OWNER_UID` and a long random `SCHEDULER_BEARER_TOKEN`, store the token in Secret Manager, and configure Cloud Scheduler to send it as a Bearer token. New services supersede unsent reminders; the scheduler also checks each reminder's service link and current service/reminder dates. A failed provider send may retry on later runs (up to 3 attempts). A reservation stuck in `processing` means the provider outcome may be unknown and is never resent automatically. Such a batch returns `partial_failure` and stores run status `reconciliation_required`.

**Reconciliation:** identify the reservation by its idempotency key and the reminder/customer IDs in the scheduler log. Check Meta WhatsApp Manager and webhook delivery events for the provider message ID. If provider acceptance is confirmed, record the missing attempt and reminder state through the approved operational procedure. If Meta confirms no submission, have an owner deliberately resolve the reservation to `failed` before retrying. Never change `processing` to `failed` based only on elapsed time. Preserve the reservation and append-only attempt history. No message is automatically resent while the result is ambiguous.

Timeouts, network interruptions, and malformed successful responses are recorded with outcome `unknown`, keep the reservation in `processing`, and make the run require reconciliation. A provider-declared rejection is recorded as `failed` and may use the existing bounded retry policy.

### Cloud Scheduler setup (GCP / Cloud Run)

Configure the job in Cloud Scheduler with schedule `0 9 * * *`, timezone `Asia/Kolkata`, target `POST https://<your-app-domain>/api/scheduler/run`, and an `Authorization: Bearer <SCHEDULER_BEARER_TOKEN>` header. Store the token in Secret Manager and restrict access to the job configuration. Set an attempt deadline that fits the expected reminder volume. `SCHEDULER_OWNER_UID` must belong to one of the verified allowlisted business accounts. The job processes the shared Aqua Plus business records.
---

## 6. Operating Cost Planning

Firebase, Meta, Resend, and Cloud Run charges depend on current provider plans, region, and actual data/message volume. Confirm current pricing and configure billing alerts before production use.

---

## 7. Automated Business Logic Test Suite (Section 14)

All 11 critical business and date calculation scenarios are tested automatically in `src/utils/testRunner.ts`:

1. Calculating next reminder date (Date + 90 days interval)
2. Applying manual date override
3. Customer-specific service intervals (60 vs 180 days)
4. Calculating days since service in `Asia/Kolkata`
5. Preventing duplicate message attempts (Idempotency key enforcement)
6. Skipping customers without recorded consent
7. Skipping paused reminders
8. Recording failed message attempts with diagnostic error details
9. Recovering from scheduled-job retries without duplicate dispatches
10. Generating the daily owner summary report
11. Preventing duplicate customer phone registrations before save

View and re-run all tests anytime in the app under **"Logic Verification"** in the sidebar.

Run the repeatable local regression suite with `npm test`; it includes the existing 11 business-logic checks plus scheduler lifecycle, reservation/persistence, webhook signature, delivery correlation, and opt-out cases. `npm run lint` and `npm run build` check types and production bundles.

Run Firestore Security Rules tests with `npm run test:rules`. This starts a local Firestore Emulator using `firebase.emulator.json`, runs `tests/firestore.rules.test.ts` against the demo-only project ID `demo-aquaplus-service-os`, then shuts the emulator down. The tests do not deploy rules or access production Firebase. Requires Java 21 or later on `PATH` and installed project dependencies (`npm install`). Never change the demo project ID in this test command to a production project.
