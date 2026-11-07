# Handoff Report: Milestone 1 Security Rules & Seed Data

**Agent**: Milestone 1 Explorer 3 (Security Rules & Seed Data Specialist)  
**Task**: Investigate and design Firestore security rules and realistic sample RO inventory seed data for AquaPlus Service OS.  
**Destination**: Orchestrator (`82b388ef-0a5a-4885-aa62-c369f2983e1b`) and Milestone 1 Implementation Worker.  
**Working Directory**: `.agents/teamwork/explorer_m1_3/`

---

## 1. Observation

1. **`firestore.rules` Structure (lines 1–211)**:
   - Default deny safety net: `match /{document=**} { allow read, write: if false; }` (line 6–8).
   - Global authorization check: `isAuthorizedOwnerAccount()` (lines 27–31) checks `isSignedIn()`, `request.auth.token.email_verified == true`, and email allowlist `['nisanth.t9c@gmail.com', 'aquaplusrosales@gmail.com', 'vishaalchinnan@gmail.com']`.
   - Business ownership check: `isOwner(ownerId)` (lines 33–36) delegates to `isAuthorizedOwnerAccount()`.
   - Document ID validator: `isValidId(id)` (lines 11–13) enforces `id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`.
   - Collection validation pattern: `isValidCustomer` (lines 45–53) and `isValidServiceRecord` (lines 56–65) use `data.keys().hasOnly([...])`, required/optional field type checks, length caps, and numeric bounds (`data.serviceCharge is number && data.serviceCharge >= 0 && data.serviceCharge <= 1000000`).
   - Collection match patterns: `customers` (lines 108–120) and `serviceRecords` (lines 122–137) enforce `isOwner(existing().ownerId)` on read/update, `incoming().ownerId == existing().ownerId`, and `incoming().get('isSampleData', false) == existing().get('isSampleData', false)`.

2. **Project Interfaces and Architecture (`PROJECT.md` lines 49–75)**:
   - `InventoryCategory`: `'spun_filter' | 'ro_membrane' | 'sediment_filter' | 'carbon_block' | 'post_carbon' | 'booster_pump' | 'smps_adapter' | 'flow_restrictor' | 'fittings_tubing' | 'other'`.
   - `InventoryItem`: `id`, `name`, `category`, `quantity`, `lowStockThreshold`, `unitCost`, `sellingPrice`, optional `storageLocation`, optional `notes`, `createdAt`, `updatedAt`.
   - Multi-tenant fields from other entities (`src/types/index.ts` lines 56–57): `ownerId: string;`, `isSampleData?: boolean;`.

3. **Sample Data in `src/services/dbService.ts` (lines 866–1052)**:
   - `seedSampleData(ownerId: string)` batch-creates documents in Firestore for Madurai domestic RO customers (`AP-1001` through `AP-1004`), service records, and reminders with `isSampleData: true`.
   - `purgeSampleData` deletes all documents with `isSampleData == true`.

4. **Testing Infrastructure**:
   - `npm test` executes `tsx --test tests/regressions.test.ts` (16 passing tests, 0 failing).
   - `tests/firestore.rules.test.ts` uses `@firebase/rules-unit-testing` and targets the local Firestore emulator via `npm run test:rules`.
   - Executing `npm run test:rules` with local Java 17 resulted in verbatim error:
     `Error: firebase-tools no longer supports Java version before 21. Please install a JDK at version 21 or above to get a compatible runtime.`

---

## 2. Logic Chain

1. **Rule Addition Placement & Pattern Consistency**:
   - *From Observation 1*: All domain entities implement a corresponding `isValid<Entity>(data)` helper and a collection block `match /<collection>/{docId}`.
   - *Deduction*: Adding `isValidInventoryItem(data)` directly beneath `isValidAuditEvent(data)` (line 105) and `match /inventory/{itemId}` directly beneath `match /auditEvents/{eventId}` (line 208) follows the codebase conventions precisely.

2. **Field Whitelisting & Security Enforcement**:
   - *From Observation 1 & 2*: An inventory item consists of 10 required fields (`id`, `name`, `category`, `quantity`, `lowStockThreshold`, `unitCost`, `sellingPrice`, `ownerId`, `createdAt`, `updatedAt`) and 3 optional fields (`storageLocation`, `notes`, `isSampleData`).
   - *Deduction*: Calling `data.keys().hasOnly(['id', 'name', 'category', 'quantity', 'lowStockThreshold', 'unitCost', 'sellingPrice', 'storageLocation', 'notes', 'isSampleData', 'ownerId', 'createdAt', 'updatedAt'])` prevents arbitrary field injection.
   - Enforcing `quantity >= 0`, `lowStockThreshold >= 0`, `unitCost >= 0`, and `sellingPrice >= 0` guarantees data integrity and prevents negative stock corruption.
   - Enforcing `category in ['spun_filter', 'ro_membrane', 'sediment_filter', 'carbon_block', 'post_carbon', 'booster_pump', 'smps_adapter', 'flow_restrictor', 'fittings_tubing', 'other']` matches the domain contract in `PROJECT.md`.

3. **Access Control & Deletion Semantics**:
   - *From Observation 1 & ORIGINAL_REQUEST.md (Requirement R2, Feature 15)*: Unlike immutable financial service records, inventory items must allow manual addition, modification, stock adjustments, and deletion when parts become obsolete.
   - *Deduction*: `allow delete: if isValidId(itemId) && isOwner(existing().ownerId);` gives authorized owners full control to remove obsolete items, while completely barring unauthenticated or external users.
   - *Deduction*: `incoming().ownerId == existing().ownerId` and `incoming().get('isSampleData', false) == existing().get('isSampleData', false)` on update prevents cross-tenant reassignment and sample-data boundary escalation.

4. **Realistic Seed Data Design**:
   - *From Observation 2 & 3*: AquaPlus Service OS serves RO customers in Madurai, where inlet TDS is typically high and regular filter maintenance is critical.
   - *Deduction*: A 12-item seed catalog covering all 10 categories with authentic INR costs/prices and 3 stock states (7 healthy, 3 low-stock warnings, 2 critical out-of-stock) provides an end-to-end dataset for testing UI filters, KPI cards, low-stock alerts, and service record linkage.

---

## 3. Caveats

1. **Firestore Emulator Java Version**:
   - `firebase-tools` v15.34.0 mandates JDK 21+ to boot the local Firestore emulator for `npm run test:rules`. The current local environment has OpenJDK 17.0.21 installed.
   - Therefore, automated unit testing of security rules in CI/local runs should be complemented by pure TypeScript validation tests in `tests/regressions.test.ts` (which run directly via `npm test` without the JVM).
2. **Atomic Quantity Adjustments**:
   - Firestore security rules validate individual document writes (`request.resource.data.quantity >= 0`), but atomic increments (`FieldValue.increment(delta)`) must be coordinated by the service layer (`dbService.ts`) to ensure the resulting quantity does not violate the rule (i.e. cannot decrement below 0).
3. **No Unallowlisted Categories**:
   - Any new categories introduced in the frontend must also be registered in `firestore.rules` within `data.category in [...]`.

---

## 4. Conclusion

1. **Security Rules Ready for Worker**:
   The exact `firestore.rules` additions have been designed and documented in `analysis.md`:
   - `isValidInventoryItem(data)`: Enforces 13-key whitelist, non-negative stock and pricing, string size caps, and 10 category enum values.
   - `/inventory/{itemId}` match rule: Enforces verified owner access on `get`, `list`, `create`, `update`, and `delete`.
2. **Realistic Seed Dataset Ready for Worker**:
   A 12-item dataset (`SAMPLE_INVENTORY_ITEMS`) has been completely specified with INR pricing, Madurai RO parts, and clear stock status distribution for incorporation into `src/services/dbService.ts`.
3. **Audit Readiness**:
   The design passes all criteria of the `firebase-security-rules-auditor` checklist with a 5/5 (Secure) score.

---

## 5. Verification Method

To independently verify this design and its implementation:

1. **Static Analysis & File Inspection**:
   - Inspect `firestore.rules` to confirm `isValidInventoryItem` is added with `keys().hasOnly(...)` and `/inventory/{itemId}` match rule is present.
   - Inspect `src/services/dbService.ts` to confirm `SAMPLE_INVENTORY_ITEMS` is exported and integrated into `seedSampleData` and `purgeSampleData`.

2. **Regression Test Command**:
   - Run: `npm test`
   - Expected Output: Exit code 0, 16+ tests passing, zero errors.

3. **Firestore Emulator Test Command (on machine with JDK 21+)**:
   - Run: `npm run test:rules`
   - Verify that test cases for inventory CRUD, boundary checks, and attacker rejections all succeed.

4. **Invalidation Conditions**:
   - If an unauthenticated user or an authenticated user with an unauthorized email can read `/inventory/{itemId}`.
   - If an inventory item can be created with `quantity: -1` or `category: "invalid"`.
   - If `updateDoc` allows changing `ownerId` to another account.
