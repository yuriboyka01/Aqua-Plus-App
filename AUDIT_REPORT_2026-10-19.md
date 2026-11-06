# AquaPlus Service OS: Technical and Security Audit

**Audit date:** 19 October 2026  
**Repository:** C:\Users\nisan\Downloads\aquaplus-service  
**Overall assessment:** Strong prototype foundation, but not yet ready for unattended production messaging.  
**Risk before live automation:** Medium-high, mainly due to reminder lifecycle and messaging-consent gaps.

## Executive summary

AquaPlus Service OS is a React and TypeScript service-management dashboard for Aqua Plus RO Tech. It combines Firebase Authentication and Firestore with an Express API layer, a Meta WhatsApp Cloud API adapter, and a Resend email adapter. The feature set covers customer records, service history, reminders, daily reports, settings, sample data, and a built-in logic verification page.

The codebase builds successfully, its TypeScript check passes, and all 11 built-in business-logic tests pass. The app also has several good security foundations: verified-owner allowlisting, server-side Firebase ID-token verification, default-deny Firestore rules, request-size limits, rate limiting, and server-side storage of provider credentials.

The most important issue is that recording a new service does not supersede older pending reminders, while the scheduler evaluates reminders individually without confirming that each one still represents the customer's latest service cycle. That can cause outdated service reminders to be sent after the customer has already been serviced. Automated opt-out and delivery-status webhooks are also still outstanding. Fix those before enabling unattended live reminders.

## Validation performed

| Check | Result | Notes |
|---|---|---|
| TypeScript check | PASS | `npm run lint` completed with exit code 0. |
| Production build | PASS | `npm run build` completed with exit code 0, including the Vite frontend and bundled Express server. |
| Built-in business-logic tests | PASS | 11 of 11 tests passed when run through the project's test runner. |
| Static code and rules review | Completed | Reviewed app structure, authentication, Firestore rules, service/reminder writes, scheduler, messaging adapters, and project documentation. |
| Live Firebase / Meta / Resend integration | Not verified | No live outbound message was sent and production credentials were not exercised. |
| Cloud deployment | Not verified | Cloud Run, Cloud Scheduler, deployed Firestore rules, backups, alerts, and webhook configuration were not tested end to end. |

The 11 passing tests are useful regression checks, but they do not replace Firestore Emulator security tests, API integration tests, or end-to-end tests. At least one scenario, the manual reminder-date override test, constructs the expected result in the test itself rather than exercising the full UI-to-database path.

## Architecture and features found

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, and lazy-loaded pages.
- **Authentication:** Google sign-in with an allowlist of verified owner emails in the client and server.
- **Data:** Firestore collections for customers, service records, reminders, message attempts, settings, reports, and audit events.
- **Server:** Express middleware for protected API endpoints and static production hosting.
- **Outbound integrations:** Meta WhatsApp Cloud API template messages and Resend email reports.
- **Scheduling:** A production daily batch, reservation records for idempotency, per-dispatch outcome persistence, and an owner report.
- **Operations:** README deployment instructions and an in-app logic verification screen.

## Findings and recommended fixes

### P1. Old pending reminders can survive a completed service

**Evidence:** The service-recording flow in `src/services/dbService.ts` creates a new service record, updates the customer's latest-service fields, and creates a new reminder. It does not reconcile older pending or overdue reminders for that customer. The eligibility logic in `src/utils/businessLogic.ts` checks the reminder date, consent, pause state, customer status, and prior successful sends, but does not verify that the reminder still matches the customer's latest service date or active reminder date. The scheduler iterates over the reminders it loads.

**Impact:** A reminder from an earlier service cycle may remain due after a newer service has been completed. It can be evaluated and potentially sent alongside the new cycle's reminder, causing confusing or duplicate customer contact.

**Recommended fix:**
1. When a service is recorded, find earlier pending reminders for that customer and mark them resolved or superseded, preserving their history rather than deleting them.
2. Add a server-side eligibility check that rejects a reminder if it does not correspond to the customer's current service cycle, for example by comparing its service record and last-service date with the customer's current service fields.
3. Add a regression test: create an overdue reminder, record a newer service, run the scheduler, and verify that the old reminder is skipped and only the current reminder can be dispatched.

### P1. Delivery confirmation and customer opt-out handling are not complete

**Evidence:** The README explicitly lists WhatsApp delivery receipts and opt-out handling as unfinished. The WhatsApp adapter reports a successful send when Meta accepts the request and returns a message ID. The reviewed server files do not implement a Meta webhook that updates delivery status or synchronizes customer opt-outs.

**Impact:** The app cannot reliably distinguish API acceptance from final delivery, and an opt-out given outside the app may not update the stored consent flag. The scheduler could continue attempting reminders based on stale consent information.

**Recommended fix:** Implement a public Meta webhook with request-signature verification, delivery-status updates keyed by provider message ID, and an opt-out workflow that updates consent before subsequent reminder runs. Until this exists, treat the current “sent” state as “accepted by the provider API,” not confirmed delivered, and avoid unattended messaging workflows that depend on automated opt-out handling.

### P2. Firestore allows deletion of message-attempt audit records

**Evidence:** In `firestore.rules`, updates to `messageAttempts` are denied, but deletes are permitted for authorized owners. This conflicts with the rules' append-only comment and the security specification's audit-integrity intent.

**Impact:** A record can be removed from the message-attempt history. That weakens auditability and can undermine any logic that relies on historical attempts. The production scheduler has separate reservation documents for automated idempotency, but that does not preserve the missing audit record.

**Recommended fix:** Deny deletion of production message-attempt records. If sample-data cleanup needs deletion privileges, isolate that workflow and explicitly limit it to records marked as sample data.

### P2. Service-charge validation is incomplete in Firestore rules

**Evidence:** The service-record validator checks that `totalAmount` is numeric and non-negative, but does not apply equivalent non-negative numeric checks to `serviceCharge` and `partsCharge`. The security specification says negative-charge injection should be rejected, but the rules do not enforce that invariant for each charge field.

**Impact:** A direct Firestore write by an authenticated owner account could store negative component charges as long as the total amount remains non-negative. That can corrupt service and payment reports even if the normal UI usually creates valid data.

**Recommended fix:** Validate all monetary fields as numbers greater than or equal to zero, set sensible upper bounds, and enforce the expected relationship between the component charges and total amount. Add Firestore Emulator tests for negative, missing, oversized, and inconsistent charge fields.

### P2. Hard-delete rules can orphan related business data

**Evidence:** Authorized owners can delete customer records and reminders. Real service-record deletion is restricted to sample records, which is good, but service records can therefore remain after their customer document is deleted.

**Impact:** Hard deletion can leave service history referencing a missing customer and can remove reminders without a clear resolution trail. The user interface's archive/restore flow is a safer business operation than deleting records.

**Recommended fix:** Prefer archive/restore for customers and resolved/superseded states for reminders. Deny hard deletion of real customer and reminder records unless there is an explicit, audited retention workflow that safely handles related records.

### P2. The WhatsApp test endpoint can message an arbitrary number without checking consent

**Evidence:** The protected `POST /api/whatsapp/test` endpoint accepts a phone number and name from the request body and sends a real template message. It is owner-authenticated and rate-limited, but the endpoint itself does not verify that the number belongs to a customer with recorded WhatsApp consent.

**Impact:** An accidental request or misuse of the test endpoint can contact a person who is not an opted-in customer. Authentication and rate limiting reduce exposure but do not enforce the consent invariant.

**Recommended fix:** Restrict test messages to a configured test phone number, or require an existing customer record with valid recorded consent. Make the endpoint unmistakably a live-message action in the UI.

### P2. A failed database write after dispatch can be hidden by a completed batch

**Evidence:** In `src/server/schedulerAdapter.ts`, the wrapper around dispatch-result persistence logs a persistence exception and continues instead of surfacing a partial failure. The production scheduler can subsequently finish and mark the run completed even when a specific dispatch outcome or reminder update was not persisted.

**Impact:** The provider may have accepted a message, but the related reminder and attempt record can be missing or stale while the overall run appears completed. A reservation may remain in “processing” and require manual reconciliation.

**Recommended fix:** Track persistence errors separately from provider-send results, return a partial-failure status, emit an operational alert, and provide a reconciliation view or runbook for reservations stuck in processing. Do not silently present a fully successful run when outcomes could not be saved.

### P3. “Configured” integration status is not a connectivity check

**Evidence:** The WhatsApp status function checks whether the access token and phone-number ID are present. The email status function checks whether the Resend key and sender are present. Neither proves that the credentials are valid or that the provider is reachable.

**Impact:** Expired or invalid credentials can appear configured until a real send fails.

**Recommended fix:** Keep the label “configured” for presence checks and add a separately labeled connectivity/credential verification action that safely handles provider errors. Do not make real outbound sends simply to probe status.

### P3. The passing test suite is not a production security or integration suite

**Evidence:** The built-in suite covers 11 business-logic scenarios and passes, but there is no demonstrated Firestore Emulator run, end-to-end API suite, provider webhook test, or deployment smoke test in the checks performed here.

**Recommended fix:** Add an explicit repeatable test command and automated tests for Firestore rules, customer/service/reminder lifecycle, scheduler retries, stale reminders, opt-out handling, and partial dispatch-persistence failures.

## Positive security and engineering controls

- Owner API endpoints verify Firebase ID tokens server-side, check revocation, require a verified allowlisted email, and limit request bodies.
- API calls have a per-owner rate limit.
- Firestore rules start with a default-deny rule and include collection-specific field allowlists and basic validation.
- The scheduler uses reservation records and idempotency keys to reduce duplicate automated sends.
- Sample data is excluded from automated outbound eligibility.
- The normal automated eligibility path checks customer WhatsApp consent, active status, pause state, and due date.
- The server does not log authorization headers or request bodies in its structured API request log.
- The project documents production credentials as server-side environment/secret-manager configuration rather than frontend build variables.

These are meaningful foundations. The gaps above are mainly lifecycle consistency, data-integrity enforcement, and completion of production messaging operations.

## Recommended go-live order

1. **Fix reminder lifecycle first.** Supersede stale reminders during service recording and independently block stale reminders in the server scheduler.
2. **Harden data integrity.** Deny deletion of message-attempt history, limit hard deletes, and validate all monetary fields in Firestore rules.
3. **Finish messaging safety.** Add verified provider webhooks and opt-out synchronization; restrict live test messages.
4. **Make partial failures visible.** Add reconciliation for stuck reservations and alerts when dispatch outcomes cannot be persisted.
5. **Add automated coverage.** Test Firestore rules in the emulator and cover the stale-reminder, duplicate-send, and failure-recovery cases.
6. **Complete deployment operations.** Configure provider credentials in a secret manager, service-account access, the production host and Firebase authorized domain, the correct Firestore rules/database, Cloud Scheduler, backups, retention, monitoring, and billing alerts. Confirm that scheduled processing is deliberately enabled only after the above protections and the intended consent workflow are verified.

## Final verdict

**Buildable and promising as an internal service-management prototype. Not yet recommended for unattended live reminder automation.** The TypeScript check, production build, and all 11 built-in logic checks passed, but those results do not validate live provider delivery or production cloud configuration. Address the two P1 findings and the data-integrity issues, then run a controlled end-to-end test with a dedicated test recipient before enabling the scheduled production workflow.


---

# Staging Verification Update: 19 October 2026

The verification work was extended after the original audit. No production deployment, production Firestore changes, or real WhatsApp/email sends were performed.

## Environment and test harness

- Installed Eclipse Temurin JDK 21 for local emulator execution.
- Added `firebase-tools` and `@firebase/rules-unit-testing` as development dependencies.
- Added `firebase.emulator.json`, which runs only the Firestore Emulator on localhost and uses the demo-only project ID `demo-aquaplus-service`.
- Added `tests/firestore.rules.test.ts` and the npm scripts `test:rules` / `test:rules:run`.
- Added tests for verified owner access, unauthenticated and unauthorized reads, unknown fields, monetary constraints, immutable sample-data markers, production-record deletion protection, append-only message attempts, terminal superseded reminders, allowed owner updates, sample cleanup, and customer references.

## Verified locally

| Check | Result |
|---|---|
| `npm run lint` | PASS, exit code 0 |
| `npm test` | PASS, exit code 0; 13 unit/regression tests |
| `npm run build` | PASS, exit code 0 |
| `npm run test:rules` | PASS, exit code 0; 13 Firestore Emulator rule tests |
| Local Express server smoke test | PASS; `GET /api/health` returned HTTP 200 and the frontend root returned HTTP 200 with HTML |

The Firestore rules tests ran against the local emulator using a demo project ID. The test suite intentionally generated permission-denied log entries for writes that must be rejected; all assertions passed. The emulator was shut down after testing. The smoke test was local-only and the temporary app server was stopped afterward.

## Remaining limitations

- The production build still emits a non-blocking large-bundle warning (main JavaScript bundle approximately 894 KB minified in the observed build). Consider follow-up bundle splitting.
- Meta webhook registration/signature behavior against a real Meta app, live delivery callbacks, opt-out behavior with real inbound messages, and Resend delivery are not externally verified.
- Cloud Run/Cloud Scheduler configuration, production service-account permissions, deployed Firestore rules, backups, monitoring, billing alerts, and incident recovery procedures are not verified.
- These results support controlled staging tests only. They do not establish readiness for unattended production messaging.
