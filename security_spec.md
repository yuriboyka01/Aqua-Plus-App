# AquaPlus Service OS Security Specification

## 1. Data Invariants
1. Only an email-verified Google account on the configured Aqua Plus business allowlist (`nisanth.t9c@gmail.com`, `aquaplusrosales@gmail.com`, or `vishaalchinnan@gmail.com`) can access this business's shared records.
2. New records use the shared `aquaplus-business` tenant ID. Legacy records keep their original `ownerId` and remain accessible to all authorized business accounts.
3. `ownerId` cannot be changed on existing records, except an existing settings document may be migrated to `aquaplus-business` when saved.
4. Every document ID must satisfy `isValidId()`.
5. Customers must have non-empty `fullName` and `primaryPhone`; unknown payload fields are rejected by collection validators.
6. Service records, reminders, and message attempts must point to an existing customer in this business.
7. Deleting service records is strictly restricted to preserve audit integrity.
8. Scheduled reminder dispatch uses deterministic idempotency reservations to reduce duplicate sends.
9. Unauthenticated requests are completely rejected.
10. An existing record's `isSampleData` marker cannot be changed to bypass deletion protections; only explicitly marked sample records may be deleted through the client rules.
11. A completed service supersedes that customer's unsent reminders; a superseded reminder is terminal and never dispatch eligible.
12. Message-attempt records are append-only and immutable. Provider delivery updates are stored in a separate server-written collection.
13. WhatsApp delivery webhooks require Meta's raw-body HMAC signature; opt-out only disables consent and never implicitly restores it.

## 2. The Dirty Dozen Payloads (Designed to be Rejected)
1. **Unauthenticated Read on Customers:** `{}` with no auth token. Result: PERMISSION_DENIED.
2. **Unauthorized Account Access:** Reading shared customer records without an email-verified account on the business allowlist. Result: PERMISSION_DENIED.
3. **Ghost Field Poisoning:** Customer payload with `{ extraMaliciousAdminFlag: true }`. Result: PERMISSION_DENIED.
4. **Id Injection Attack:** Customer document with ID longer than 128 chars or special characters `../../../etc`. Result: PERMISSION_DENIED.
5. **Customer Phone Injection:** Phone string containing 5000 characters. Result: PERMISSION_DENIED.
6. **Immutable Field Tamper:** Updating a ServiceRecord with a changed `ownerId`. Result: PERMISSION_DENIED.
7. **Service Record Deletion by Non-Owner:** Deleting a service visit without verified owner privileges. Result: PERMISSION_DENIED.
8. **Message Attempt Alteration:** Updating an already stored MessageAttempt. Result: PERMISSION_DENIED.
9. **Shared Listing by Authorized User:** An authorized business account can query shared customers; an unauthorized account cannot. Result: PERMISSION_DENIED for the unauthorized account.
10. **Negative Charge Injection:** Service record with invalid numbers. Result: PERMISSION_DENIED.
11. **Settings Tamper by Anonymous User:** Updating business settings unauthenticated. Result: PERMISSION_DENIED.
12. **Audit Event Fabrication:** Spoofing another user's action log. Result: PERMISSION_DENIED.

## 3. Reminder, Messaging, and Monetary Invariants

- Current-cycle reminder dispatch requires the reminder service link/date and scheduled date to match the customer's latest service date and next reminder date. Missing legacy linkage fails closed for automated sending.
- `sent` on a message attempt means Meta accepted the submission and returned a provider message ID. Delivery and read state are recorded separately in `messageDeliveryStatus` and append-only `messageDeliveryEvents`.
- A provider result that cannot be persisted leaves the idempotency reservation in `processing`, reports reconciliation required, and is never automatically resent.
- Network timeouts and malformed successful provider responses are recorded as `unknown` with the reservation left in `processing`; provider-declared rejection remains `failed` and follows the bounded retry policy.
- Service labor, parts, and total amounts are each numeric, non-negative, and capped at INR 1,000,000 per service record. The UI calculates the total from labor and parts, while the stored total remains independently validated to preserve existing manual form behavior.
- Real customer and reminder documents cannot be permanently deleted through normal Firestore client operations. Sample cleanup remains limited to sample records. Real service history, message attempts, audit events, and delivery events are preserved.
- The test endpoint only accepts the server-configured `WHATSAPP_TEST_RECIPIENT`. Actual reminder sends use customer and reminder IDs and re-check consent and current-cycle eligibility on the server.
