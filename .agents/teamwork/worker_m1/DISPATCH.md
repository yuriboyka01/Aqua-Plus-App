## 2026-11-07T04:55:01Z
You are Milestone 1 Worker for AquaPlus Service OS Inventory Management.

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\ORIGINAL_REQUEST.md

Also read the project architecture, milestone breakdown, and interface contracts at:
c:\Users\nisan\Downloads\aquaplus-service\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Working Directory:
c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\worker_m1\

Explorer Reports to follow:
- Domain Types: c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m1_1\analysis.md
- Firestore dbService: c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m1_2\analysis.md
- Security Rules & Seed Data: c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m1_3\analysis.md

Exclusive File Ownership:
You have exclusive write access to:
- `src/types/index.ts`
- `src/services/dbService.ts`
- `firestore.rules`
- `tests/regressions.test.ts`

Implementation Tasks:
1. `src/types/index.ts`:
   Implement `InventoryCategory`, `InventoryItem`, `StockStatus`, `getStockStatus` (with defensive fallback for 0, negative, NaN), `INVENTORY_CATEGORIES`, `INVENTORY_CATEGORY_LABELS`, `isInventoryCategory`, `ScannedItemSuggestion`, `InventoryScanResult`, `InventoryScanRequest`, `UsedPartEntry`, `StockAdjustment`, `InventorySummaryMetrics`, and expand `AuditEvent` entity types to include `'InventoryItem'`.
2. `firestore.rules`:
   Implement `isValidInventoryItem(data)` validation helper function (whitelisting keys via `data.keys().hasOnly(...)`, validating types, ranges, non-negative amounts, and category) and the `/inventory/{itemId}` match rule with strict owner authorization, create/update constraints, and safe sample delete rules.
3. `src/services/dbService.ts`:
   Implement:
   - `subscribeInventory(callback, onError)` and `subscribeInventory(ownerId, callback, onError)` with real-time `onSnapshot` listener and guest/sample data fallback.
   - `addInventoryItem(itemData, ownerId)` with auto-generated ID, timestamping, non-negative clamping, and audit logging.
   - `updateInventoryItem(id, updates, ownerId)` with timestamping and audit logging.
   - `adjustInventoryQuantity(id, delta, reason, ownerId)` using Firestore transactions (`runTransaction`), clamping to `>= 0`, returning `{ previousQuantity, newQuantity, clamped }`, and recording audit log.
   - `deleteInventoryItem(id, ownerId)` with safe timeout and audit logging.
   - `getInventoryItem(id)` helper.
   - 10-12 item realistic RO inventory seed dataset (`getInitialSampleInventory`) with Madurai/Indian context, INR pricing, and diverse stock states (healthy, low stock, out of stock), integrated into `getInitialSampleDataSet`, `seedSampleData`, and `purgeSampleData`.
4. `tests/regressions.test.ts`:
   Add automated tests verifying:
   - `getStockStatus` boundary values (`out_of_stock` for 0 and negative, `low_stock` for `<= lowStockThreshold`, `in_stock` for `> lowStockThreshold`).
   - `validateInventoryItem` / item shape validation.
   - Stock adjustment arithmetic and non-negative clamping logic.
   - Initial sample inventory integrity (valid categories, prices, counts).
5. Verification:
   Run build and test commands:
   - `npm run lint` (`tsc --noEmit`)
   - `npm test` (`tsx --test tests/regressions.test.ts`)
   Ensure all tests pass and exit code is 0.

Output Requirements:
- Update progress.md with your liveness and status.
- Document implemented changes, build outputs, and test results in `c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\worker_m1\handoff.md` following the Handoff Protocol.
- Send a message to the orchestrator when completed.
