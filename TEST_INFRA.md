# E2E Test Infra: AquaPlus Service OS Inventory Management

## Test Philosophy
- **Requirement-Driven & Opaque-Box**: Tests are derived directly from `ORIGINAL_REQUEST.md` (R1-R4) and acceptance criteria, independent of internal module implementation.
- **Progressive Testability**: Verification mechanisms do not require features more complex than what they verify. Early tiers verify basic CRUD and calculation rules before higher-tier vision or multi-entity workflows.
- **Robustness**: Rigorous negative tests verify graceful error handling, fallback on unrecognized images, missing API keys, out-of-stock scenarios, and invalid form data.

## Feature Inventory Coverage Map
| # | Feature | Source | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Workloads) |
|---|---------|--------|:-----------------:|:-----------------:|:-----------------:|:------------------:|
| 1 | Inventory Data Model & Types | R1 | 5 | 5 | ✓ | ✓ |
| 2 | Firestore Data Access Layer (CRUD) | R1, R2 | 5 | 5 | ✓ | ✓ |
| 3 | Firestore Security Rules | R1, R2 | 5 | 5 | ✓ | ✓ |
| 4 | Sample Inventory Data | R1 | 5 | 5 | ✓ | ✓ |
| 5 | Gemini Vision Scan Endpoint | R3 | 5 | 5 | ✓ | ✓ |
| 6 | Multimodal Vision Prompt & Schema | R3 | 5 | 5 | ✓ | ✓ |
| 7 | Client-Side Image Pre-processor | R3 | 5 | 5 | ✓ | ✓ |
| 8 | Vision API Error & Fallback Handling | R3 | 5 | 5 | ✓ | ✓ |
| 9 | Inventory Catalog View | R1 | 5 | 5 | ✓ | ✓ |
| 10 | Stock Status & Alert Badges | R1 | 5 | 5 | ✓ | ✓ |
| 11 | KPI Summary Cards | R1 | 5 | 5 | ✓ | ✓ |
| 12 | Search & Category Filters | R1 | 5 | 5 | ✓ | ✓ |
| 13 | Manual Item Creation & Edit | R2 | 5 | 5 | ✓ | ✓ |
| 14 | Quick Stock Adjust Steppers | R2 | 5 | 5 | ✓ | ✓ |
| 15 | Item Deletion Dialog | R2 | 5 | 5 | ✓ | ✓ |
| 16 | Camera & Image Capture UI | R3 | 5 | 5 | ✓ | ✓ |
| 17 | Review & Confirmation Modal | R3 | 5 | 5 | ✓ | ✓ |
| 18 | Desktop Sidebar Navigation | R4 | 5 | 5 | ✓ | ✓ |
| 19 | Mobile Bottom Navigation | R4 | 5 | 5 | ✓ | ✓ |
| 20 | Main App Routing & Tab State | R4 | 5 | 5 | ✓ | ✓ |
| 21 | Service Record Parts Deduction | R4 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runners**:
  1. CLI Test Suite: `tests/regressions.test.ts` executed via Node's native test runner (`tsx --test tests/regressions.test.ts` or `npm test`).
  2. Security Rules Suite: `npm run test:rules` (Firestore Emulator security rules tests).
  3. In-App Interactive Test Runner: `src/utils/testRunner.ts` surfaced on `AutomatedTestsPage.tsx`.
- **Pass/Fail Semantics**: All tests must complete with exit code 0, 0 test failures, and 0 unhandled promise rejections.
- **Fixture Strategy**: Mock fixtures and sample images representing RO spare parts (spun filter, RO membrane, booster pump) and supplier bills/invoices.

## Test Tiers Breakdown
- **Tier 1 — Feature Coverage**: Baseline happy-path tests verifying inventory creation, retrieval, updates, stock increments, vision response handling, and tab switching.
- **Tier 2 — Boundary & Corner Cases**: Edge cases such as quantity = 0, quantity = lowStockThreshold, negative quantities clamped to 0, extreme costs, missing image files, unreadable/blurry images, empty vision responses, missing API keys.
- **Tier 3 — Cross-Feature Combinations**: Pairwise interactions: vision scan -> review edit -> create new item -> check catalog filter -> deduct part in service visit -> verify low-stock alert update.
- **Tier 4 — Real-World Application Scenarios**: End-to-end field technician and workshop owner workflows:
  1. *Scenario 1: Bulk restock intake via supplier invoice photo scan, reviewing detected items and incrementing existing stock.*
  2. *Scenario 2: Field technician service visit replacing 5µ spun filter and RO membrane, deducting stock and updating customer service history.*
  3. *Scenario 3: Unrecognized/damaged bill photo graceful fallback to manual entry without app crash or lost data.*
  4. *Scenario 4: Workshop inventory audit with category filtering, search, and manual quantity adjustments.*
  5. *Scenario 5: Low-stock warning trigger and notification badge in desktop and mobile navigation.*

## Coverage Thresholds
- Tier 1: ≥ 105 test assertions
- Tier 2: ≥ 105 test assertions
- Tier 3: ≥ 21 interaction assertions
- Tier 4: ≥ 5 realistic application scenarios
