# Handoff Report: Domain Types & Validation Specification

**Agent**: `explorer_m1_1` (Domain Types & Validation Specialist)  
**Parent**: `82b388ef-0a5a-4885-aa62-c369f2983e1b`  
**Milestone**: Milestone 1 (Data Models, Firestore Persistence & Security Rules)  
**Target File**: `src/types/index.ts`  
**Handoff Type**: Hard (Investigation complete)

---

## 1. Observation

1. **Existing Types in `src/types/index.ts`**:
   - `src/types/index.ts` lines 1–208 contains 8 type aliases (`ServiceCategory`, `PaymentStatus`, `CustomerStatus`, `ReminderStatus`, `MessageDispatchStatus`, `GatewayConfigStatus`) and 8 interfaces (`Customer`, `ServiceRecord`, `Reminder`, `MessageAttempt`, `MessageDeliveryEvent`, `OwnerReport`, `AppSettings`, `AuditEvent`, `DashboardMetrics`).
   - Every entity persisted in Firestore defines `id: string`, `ownerId: string`, `createdAt: string`, `updatedAt: string`, and optionally `isSampleData?: boolean`.
   - Specifically, `AuditEvent` at lines 188–196 defines:
     ```typescript
     export interface AuditEvent {
       id: string;
       action: string;
       details: string;
       entityType: 'Customer' | 'ServiceRecord' | 'Reminder' | 'Settings' | 'BatchScheduler';
       entityId?: string;
       ownerId: string;
       timestamp: string;
     }
     ```
2. **Firestore Rule Constraints in `firestore.rules`**:
   - Lines 46, 57, 69, 79, 88, 95, 102 all enforce strict field whitelisting using `data.keys().hasOnly([...])`.
   - Any document containing a field not listed in `keys().hasOnly` fails rule evaluation and rejects writes.
   - All collections require `isOwner(incoming().ownerId)` or `isOwner(existing().ownerId)`.
   - Deletion rules (e.g. lines 119, 136, 153) explicitly require `existing().isSampleData == true` to prevent accidental deletion of live business records.
3. **Architecture Contract in `PROJECT.md`**:
   - Lines 51–61 define `InventoryCategory` with 10 values: `'spun_filter' | 'ro_membrane' | 'sediment_filter' | 'carbon_block' | 'post_carbon' | 'booster_pump' | 'smps_adapter' | 'flow_restrictor' | 'fittings_tubing' | 'other'`.
   - Lines 63–75 define `InventoryItem` with `id`, `name`, `category`, `quantity`, `lowStockThreshold`, `unitCost`, `sellingPrice`, `storageLocation?`, `notes?`, `createdAt`, `updatedAt`.
   - Lines 77–83 define `StockStatus` (`'in_stock' | 'low_stock' | 'out_of_stock'`) and `getStockStatus(item: Pick<InventoryItem, 'quantity' | 'lowStockThreshold'>)`.
   - Lines 88–109 define `ScannedItemSuggestion`, `InventoryScanResult`, and `POST /api/inventory/scan` request payload (`imageBase64: string, mimeType: string`).
   - Lines 114–119 define `UsedPartEntry` with `itemId`, `name`, `quantity`, `unitPrice`.
4. **TypeScript & Test Health**:
   - `npm run lint` (`tsc --noEmit`) succeeded with exit code 0.
   - `npm test` (`tsx --test tests/regressions.test.ts`) executed 16 tests in 325ms, all passing with 0 failures.
   - `tsconfig.json` has `isolatedModules: true`, `moduleDetection: "force"`, and `allowImportingTsExtensions: true`.

---

## 2. Logic Chain

1. **Firestore Rule Alignment & Entity Parity**:
   - From Observation 2, `firestore.rules` verifies `ownerId` on all incoming documents and uses `isSampleData == true` for safe sample deletions.
   - From Observation 3, the `PROJECT.md` snippet for `InventoryItem` omits `ownerId` and `isSampleData`.
   - Therefore, `InventoryItem` must include `ownerId: string` and `isSampleData?: boolean` to maintain parity with `Customer` and satisfy `isValidInventoryItem(data)` and `isOwner(incoming().ownerId)`.
2. **Defensive Status Calculation**:
   - From Observation 3, `getStockStatus` must return `'out_of_stock'` when `quantity <= 0`, `'low_stock'` when `quantity <= lowStockThreshold`, and `'in_stock'` otherwise.
   - In production UI and API contexts, missing or `NaN` inputs might occur before user input is sanitized.
   - Defaulting `NaN` or `undefined` to `0` inside `getStockStatus` prevents runtime comparison errors from falsely classifying empty stock as `'in_stock'`.
3. **Category Enum Ergonomics**:
   - From Observation 3, there are 10 snake_case categories in `InventoryCategory`.
   - Components across M3 (filters, dropdowns, table badges) and M2 (Gemini prompt enum) require both the list of allowed values and human-readable titles.
   - Providing `INVENTORY_CATEGORIES`, `INVENTORY_CATEGORY_LABELS`, and a type guard `isInventoryCategory(value: unknown): value is InventoryCategory` directly in `src/types/index.ts` ensures single-source-of-truth across UI, server, and test code.
4. **Audit System Extensibility**:
   - From Observation 1, `AuditEvent.entityType` was restricted to 5 entity types.
   - Adding `'InventoryItem'` to `AuditEntityType` allows `recordAuditEvent` in `dbService.ts` to log inventory events (`INVENTORY_ITEM_CREATED`, `INVENTORY_STOCK_ADJUSTED`) without type assertion workarounds.
5. **Non-Breaking Verification**:
   - From Observation 1 and 4, all existing types remain identical; the changes are 100% additive. Existing tests and type checks continue to pass without modification.

---

## 3. Caveats

1. **`ServiceRecord.usedParts` Persistence**:
   - In `PROJECT.md` line 114, `UsedPartEntry` is specified for M4 service linkage.
   - In `firestore.rules` line 57, `isValidServiceRecord` currently strictly validates only 22 fields.
   - If M4 decides to persist `usedParts` directly inside the `serviceRecords` Firestore document, `isValidServiceRecord` in `firestore.rules` must also whitelist `usedParts`. If it is only used in-memory in `RecordServiceModal.tsx` to calculate `partsCharge` and update `inventory` stock, no change to `isValidServiceRecord` is needed.
2. **Read-Only Explorer Scope**:
   - In accordance with the explorer role, no edits were made to `src/types/index.ts` or any code outside `.agents/teamwork/explorer_m1_1/`. The concrete implementation is prepared for the Worker.

---

## 4. Conclusion

The domain types and validation specifications are fully designed and verified:
- `InventoryCategory`: 10 snake_case members with `INVENTORY_CATEGORIES`, `INVENTORY_CATEGORY_LABELS`, and `isInventoryCategory`.
- `InventoryItem`: 12 properties (`id`, `name`, `category`, `quantity`, `lowStockThreshold`, `unitCost`, `sellingPrice`, `storageLocation?`, `notes?`, `isSampleData?`, `ownerId`, `createdAt`, `updatedAt`).
- `StockStatus`: `'in_stock' | 'low_stock' | 'out_of_stock'` with `STOCK_STATUS_LABELS`.
- `getStockStatus`: pure function with `NaN` resilience and explicit boundary handling.
- Auxiliary types: `ScannedItemSuggestion`, `InventoryScanResult`, `InventoryScanRequest`, `UsedPartEntry`, `StockAdjustment`, `InventorySummaryMetrics`, `AuditEntityType`, `InventoryAuditAction`.
- Form & Validation: `InventoryItemInput` and `validateInventoryItem`.

The worker can apply the exact code changes specified in `analysis.md` Section 7 without risk of breaking existing functionality.

---

## 5. Verification Method

Once the Worker applies the changes to `src/types/index.ts`:

1. **Compile & Typecheck Verification**:
   ```bash
   npm run lint
   ```
   *Expected output*: `tsc --noEmit` exits with code 0 and zero type errors.

2. **Automated Regression Suite Verification**:
   ```bash
   npm test
   ```
   *Expected output*: All existing 16 tests pass, plus new inventory unit tests pass.

3. **Status Calculation Unit Checks**:
   Inspect and verify the truth table in `tests/regressions.test.ts`:
   - `getStockStatus({ quantity: 0, lowStockThreshold: 5 }) === 'out_of_stock'`
   - `getStockStatus({ quantity: -1, lowStockThreshold: 5 }) === 'out_of_stock'`
   - `getStockStatus({ quantity: 5, lowStockThreshold: 5 }) === 'low_stock'`
   - `getStockStatus({ quantity: 4, lowStockThreshold: 5 }) === 'low_stock'`
   - `getStockStatus({ quantity: 6, lowStockThreshold: 5 }) === 'in_stock'`

4. **Invalidation Conditions**:
   The design is invalidated if:
   - Any of the 10 `InventoryCategory` strings diverges from the prompt or `PROJECT.md`.
   - Field names in `InventoryItem` do not match `isValidInventoryItem` in `firestore.rules`.
   - `npm run lint` reports module resolution errors in Vite.
