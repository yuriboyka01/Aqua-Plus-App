# Handoff Report: Firestore Service Layer for Inventory Management

**Agent:** Milestone 1 Explorer 2 (Firestore Service Layer Specialist)  
**Destination Path:** `c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m1_2\handoff.md`  
**Milestone:** Milestone 1 — Data Models, Firestore Persistence & Security Rules (Features 1, 2, 3, 4)  
**Date:** 2026-11-07  

---

## 1. Observation

1. **`src/services/dbService.ts` Structure & Dependencies:**
   - Lines 1–12 import Firestore functions: `collection`, `doc`, `setDoc`, `updateDoc`, `deleteDoc`, `onSnapshot`, `writeBatch`, `getDocs`, `query`, `where`. Currently, `runTransaction` and `getDoc` are not imported.
   - Line 13 imports `{ db, handleFirestoreError, OperationType }` from `../lib/firebase`.
   - Lines 68–77 define `withTimeout(promise, ms = 12000, errorMsg)`. Every data write (`setDoc`, `updateDoc`, `deleteDoc`) uses `await withTimeout(...)`.
   - Lines 96–107 (`addCustomer`) and lines 119–135 (`updateCustomer`) wrap operations in `try/catch` blocks and forward caught exceptions to `handleFirestoreError(err, OperationType.*, path)`.
   - Lines 97–103, 126–132, 243–249, 316–322, 505–511, and 594–619 implement audit trail recording via `recordAuditEvent(action, details, entityType, entityId, ownerId)`. Lines 103 and 132 use `.catch((e) => console.warn('Non-blocking audit log notice:', e))` for non-blocking logging.
   - Lines 625–864 define `getInitialSampleDataSet(ownerId = 'guest_owner')`, returning in-memory `{ customers, serviceRecords, reminders }`.
   - Lines 866–1024 define `seedSampleData(ownerId)`, batch-writing sample documents with `isSampleData: true`.
   - Lines 1026–1052 define `purgeSampleData(customers, services, reminders, ownerId)`, deleting documents where `isSampleData === true`.

2. **Tenant Identity & App Configuration:**
   - `src/lib/constants.ts` line 4 defines `export const BUSINESS_OWNER_ID = 'aquaplus-business';`.
   - `src/App.tsx` line 120 sets `const effectiveOwnerId = BUSINESS_OWNER_ID;` and passes it to all subscription listeners: `subscribeCustomers(effectiveOwnerId, setCustomers)`.
   - Lines 45–47 of `src/services/dbService.ts`: `if (!ownerId || ownerId === 'guest_owner') return () => {};`.

3. **Domain Contracts & Types:**
   - `PROJECT.md` lines 50–84 define `InventoryCategory`, `InventoryItem`, `StockStatus`, and `getStockStatus`.
   - `src/types/index.ts` lines 188–196 define `AuditEvent` with `entityType: 'Customer' | 'ServiceRecord' | 'Reminder' | 'Settings' | 'BatchScheduler'`.

4. **Security Rules Contract:**
   - `firestore.rules` line 11–13 requires `isValidId(id)` matching `'^[a-zA-Z0-9_\\-]+$'`.
   - `firestore.rules` lines 27–36 enforce `isAuthorizedOwnerAccount()` through verified email whitelist.
   - Explorer M1-3 dispatch defines `/inventory/{itemId}` match rule with read, create, update, and delete permissions for authorized owner accounts.

---

## 2. Logic Chain

1. **Alignment with Architecture & Multi-Tenancy:**
   From Observation 1 and 2, every document in Firestore belongs to a business owner (`ownerId = 'aquaplus-business'`). By defaulting `ownerId: string = BUSINESS_OWNER_ID` across all new inventory functions, callers can invoke functions simply as `addInventoryItem(data)` or with explicit tenant IDs `addInventoryItem(data, ownerId)`.

2. **Dual-Signature Flexibility for Subscriptions:**
   From Observation 1 and 2, UI pages might call `subscribeInventory(setItems)` or `subscribeInventory(ownerId, setItems)`. Designing `subscribeInventory` to inspect `typeof ownerIdOrCallback === 'function'` satisfies both patterns without type ambiguity or runtime breakages. When `ownerId === 'guest_owner'` or offline preview is active, returning `getInitialSampleInventory(ownerId)` ensures instant UI rendering.

3. **Concurrency & Atomicity for Stock Adjustments:**
   From Observation 1 (`dbService.ts`), multiple technicians record service usage and stock replenishment. A non-transactional read-then-write would suffer race conditions. Incorporating `runTransaction(db, async (transaction) => { ... })` guarantees serializable execution. Clamping `Math.max(0, currentQty + delta)` prevents negative stock balances as mandated by R2 in `ORIGINAL_REQUEST.md`.

4. **Auditability & Observability:**
   From Observation 1 (`recordAuditEvent`) and 3 (`AuditEvent`), inventory state transitions have direct financial consequences. Logging `INVENTORY_ITEM_CREATED`, `INVENTORY_ITEM_UPDATED`, `INVENTORY_STOCK_ADJUSTED`, and `INVENTORY_ITEM_DELETED` maintains the compliance audit trail expected by business owners.

5. **Sample Data Isolation & Lifecycle:**
   From Observation 1 (lines 625–1052), demo data must never contaminate production data. Supplying 10 realistic Madurai RO spare parts with `isSampleData: true`, integrating them into `getInitialSampleDataSet`, `seedSampleData`, and `purgeSampleData`, provides immediate testability for Milestone 3 UI and Milestone 5 automated tests while allowing one-click complete cleanup.

---

## 3. Caveats

1. **Type Definition Prerequisite:** The Worker implementing `dbService.ts` changes relies on `InventoryItem` being exported from `src/types/index.ts` (handled by Milestone 1 Explorer 1). If `dbService.ts` is modified before `src/types/index.ts`, `tsc` will report a missing type error.
2. **Firestore Rules Prerequisite:** Live writes to the `/inventory/{itemId}` collection in an active Firebase environment require the matching rule in `firestore.rules` (handled by Milestone 1 Explorer 3) to be deployed.
3. **Audit Log Union Type:** `AuditEvent.entityType` in `src/types/index.ts` should include `'InventoryItem'`. Until updated, a cast `'InventoryItem' as any` is used to prevent TypeScript compiler errors.

---

## 4. Conclusion

The Firestore data access layer design for Inventory Management is fully architected and ready for worker implementation in `src/services/dbService.ts`.

Summary of components to add:
- **`subscribeInventory(callback, onError)`** / **`subscribeInventory(ownerId, callback, onError)`**: Real-time snapshot listener on the `inventory` collection, sorted by item name, with guest/demo fallback.
- **`addInventoryItem(data, ownerId)`**: Auto-generates doc ID or uses provided ID, clamps numeric values to `>= 0`, sets `createdAt` and `updatedAt`, protects with `withTimeout`, and records `INVENTORY_ITEM_CREATED`.
- **`updateInventoryItem(id, updates, ownerId)`**: Sanitizes input (preserves `id` and `createdAt`), updates fields, updates `updatedAt`, and records `INVENTORY_ITEM_UPDATED`.
- **`adjustInventoryQuantity(id, delta, reason, ownerId)`**: Atomic transaction modifying `quantity`, clamping to `>= 0` minimum, returning `{ previousQuantity, newQuantity, clamped }`, and awaiting `INVENTORY_STOCK_ADJUSTED` audit log.
- **`deleteInventoryItem(id, ownerId)`**: Deletes document with timeout protection and records `INVENTORY_ITEM_DELETED`.
- **`getInventoryItem(id)`**: Point lookup helper.
- **`getInitialSampleInventory(ownerId)`**: 10 realistic RO spare parts across healthy, low-stock, and out-of-stock states.
- **Extended `getInitialSampleDataSet`, `seedSampleData`, `purgeSampleData`**: Complete sample lifecycle support.

The full design, code snippets, and seed dataset are documented in `c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m1_2\analysis.md`.

---

## 5. Verification Method

1. **TypeScript Compilation:**
   ```powershell
   npx tsc --noEmit
   ```
   *Expected outcome:* Zero type errors across `src/services/dbService.ts`.

2. **Automated Unit & Regression Tests:**
   ```powershell
   node --test tests/regressions.test.ts
   ```
   *Expected outcome:* All existing tests (11/11 business logic tests, scheduler tests, webhook tests) pass with zero failures.

3. **Code Inspection:**
   - Inspect `src/services/dbService.ts` to confirm `runTransaction`, `getDoc`, and `InventoryItem` are properly imported.
   - Confirm all 5 functions (`subscribeInventory`, `addInventoryItem`, `updateInventoryItem`, `adjustInventoryQuantity`, `deleteInventoryItem`) and seed data helpers are exported.
   - Verify that `adjustInventoryQuantity` uses `runTransaction` and clamps `newQty = Math.max(0, currentQty + delta)`.
