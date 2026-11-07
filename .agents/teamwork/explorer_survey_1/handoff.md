# Handoff Report — Codebase Architecture & Navigation Survey

**Agent:** Codebase Architecture & Navigation Explorer (`explorer_survey_1`)  
**Parent Task ID / Sender:** `82b388ef-0a5a-4885-aa62-c369f2983e1b`  
**Date:** 2026-11-07  
**Artifact Path:** `c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_survey_1\survey_architecture.md`

---

## 1. Observation

1. **Routing and State Architecture**:
   - `src/App.tsx:82`: Navigation state is stored as a React state variable: `const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');`. There is no `react-router` dependency in `package.json`.
   - `src/components/Sidebar.tsx:20-28`: `ActiveTab` union type is explicitly defined:
     ```typescript
     export type ActiveTab =
       | 'dashboard'
       | 'customers'
       | 'record_service'
       | 'service_history'
       | 'reminders'
       | 'daily_reports'
       | 'settings'
       | 'automated_tests';
     ```
   - `src/App.tsx:466-563`: Views are rendered conditionally based on `activeTab` inside `<main>` wrapped in `<Suspense fallback={...}>`. Modals and pages are dynamically loaded with `lazy()`.

2. **Navigation Components**:
   - `src/components/Sidebar.tsx:50-109`: Defines `navItems` array with `id`, `label`, `sublabel`, `icon`, `badge`, and `badgeColor`. Lines 110-111 partition items: `primaryItems = navItems.slice(0, 5);` and `secondaryItems = navItems.slice(5);`. Line 149 shows desktop visibility: `hidden md:flex`.
   - `src/components/MobileNav.tsx:20-77`: Fixed bottom navigation bar for mobile (`md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0C231F] border-t border-[#1C3E37]`). Contains 4 standard navigation buttons (`dashboard`, `customers`, `reminders`, `settings`) and 1 center floating action button (`-mt-6 bg-[#C25E00] w-14 h-14 rounded-full`) triggering `onOpenRecordService`.
   - `src/components/Navbar.tsx:42-151`: Sticky top header on both desktop and mobile, with global search input that redirects to the `customers` tab when typed into (`src/components/Navbar.tsx:73-75`).

3. **Styling and Design System**:
   - `package.json:27, 49`: Tailwind CSS v4 (`tailwindcss ^4.3.3`, `@tailwindcss/vite ^4.3.3`).
   - `src/index.css:1-24`: Base background `#FAF8F3`, text `#1B2421`, editorial serif `.font-editorial` (`Fraunces`), data mono `.font-mono-data` (`JetBrains Mono`), UI sans `.font-sans-ui` (`Plus Jakarta Sans`).
   - Deep Bottle Green palette (`#0C231F`, `#0A1D1A`, `#174238`, `#163830`), amber accents (`#C25E00`), mint accents (`#7EE787`, `#165B50`), paper card parchment (`#F4F0E6`, `#FAF8F3`, border `#E5DEC9`, `#DDD6C5`).
   - `lucide-react: ^0.546.0` used for all icons.

4. **Existing Views & Conventions**:
   - `src/pages/CustomersPage.tsx:48-93`: Uses `useMemo` for real-time text search, category filters, and sorting. Responsive design switches between wide scrollable tables and card layouts.
   - `src/components/RecordServiceModal.tsx:350-384`: Tracks replaced parts as freeform text (`filtersReplaced: string`) and `partsCharge: number`, with quick-add badge buttons (`5µ Spun Filter`, `Carbon Block`, `TFC RO Membrane`, `Post-Carbon / Mineral`, etc.).
   - `src/context/AuthContext.tsx`: Manages authentication state and verifies owner allowlist from `OWNER_EMAILS`.

5. **Backend, Database & Security Rules**:
   - `package.json:25`: Official Google GenAI SDK `@google/genai: ^2.4.0` is already in dependencies.
   - `.env.example:1-2`: `GEMINI_API_KEY="MY_GEMINI_API_KEY"` documented for AI vision calls.
   - `src/server/apiMiddleware.ts`: Connect/Express middleware handling `/api/` endpoints (health, webhooks, integrations, scheduler). Has `authenticateOwner(req)` verifying Firebase ID tokens against `OWNER_EMAILS`.
   - `firestore.rules:45-105, 108-208`: Strict Firestore security rules with key whitelisting (`data.keys().hasOnly(...)`). Collections `customers`, `serviceRecords`, `reminders`, `messageAttempts`, `ownerReports`, `settings`, and `auditEvents` are defined with owner-only access.

6. **Testing Setup & Verification**:
   - `package.json:13`: `"test": "tsx --test tests/regressions.test.ts"`.
   - Command `npm test`: Exited with code 0 (`16 tests pass, 0 fail, 401ms`).
   - Command `npm run lint` (`tsc --noEmit`): Exited with code 0 (no type errors).
   - `src/utils/testRunner.ts`: In-app test runner executing 11 business logic tests, displayed on `AutomatedTestsPage.tsx`.

---

## 2. Logic Chain

1. **Routing Strategy**:
   - Because routing is state-driven via the `ActiveTab` type (Observation 1), introducing the new Inventory Management view requires extending `ActiveTab` with `'inventory'` and conditionally rendering `<InventoryPage />` in `App.tsx:466-563`.
   - No router configuration, path regexes, or hash listeners need to be introduced, keeping changes minimal and consistent with the existing codebase pattern.

2. **Navigation Integration**:
   - In `Sidebar.tsx`, adding `{ id: 'inventory', label: 'Inventory', sublabel: 'Parts & stock levels', icon: Package, badge: lowStockCount > 0 ? ... : null }` integrates directly into the desktop sidebar (Observation 2).
   - In `MobileNav.tsx`, placing `Inventory` as a bottom navigation item or alongside `Customers` and `Reminders` ensures full parity on Capacitor mobile shells (Observation 2).
   - In `App.tsx`, calculating `lowStockCount` from the inventory items collection provides the badge count for both navigation components.

3. **Domain & Storage Integration**:
   - Because Firestore security rules strictly require `data.keys().hasOnly(...)` (Observation 5), creating a new collection `inventoryItems` requires:
     1. Defining `InventoryItem` in `src/types/index.ts`.
     2. Adding CRUD functions (`subscribeInventoryItems`, `addInventoryItem`, `updateInventoryItem`, `adjustInventoryStock`, `deleteInventoryItem`) in `src/services/dbService.ts`.
     3. Updating `firestore.rules` with `isValidInventoryItem(data)` and matching collection rules.

4. **AI Vision & Gemini Integration**:
   - `@google/genai` is already installed in `package.json` (Observation 5), and `GEMINI_API_KEY` is supported in `.env.example`.
   - In accordance with Security Rule 5 (never expose secrets client-side), an endpoint `POST /api/inventory/scan` in `src/server/apiMiddleware.ts` should receive the image, invoke Gemini 2.5 Flash / Gemini Vision via `@google/genai`, and return structured item names, quantities, and prices to the frontend confirmation modal.

5. **Service Records Linkage**:
   - In `RecordServiceModal.tsx` (Observation 4), replacing or augmenting freeform `filtersReplaced` with an inventory picker links parts usage with inventory deductions when service visits are recorded.

---

## 3. Caveats

1. **Camera API on Android Capacitor Shell**:
   - Currently, `@capacitor/camera` is not installed in `package.json`. However, standard HTML5 `<input type="file" accept="image/*" capture="environment" />` works out of the box in modern mobile browsers and the Capacitor Android WebView. If native hardware camera plugins are desired later, `@capacitor/camera` can be added, but standard file capture is fully functional without native build dependencies.
2. **Firestore Emulator vs Live Firestore**:
   - Real-time Firestore subscriptions rely on authorized Google accounts or email/password login. In local test environments without live credentials, sample data mode (`isSampleData: true`) is used.
3. **No External Router**:
   - Direct deep-linking via URL paths (e.g. `domain.com/inventory`) is not supported in the existing architecture because the app uses tab-based state; this is by design for this single-page field app.

---

## 4. Conclusion

The AquaPlus Service OS codebase possesses a clean, cohesive architecture and design system. Integrating Inventory Management requires touching well-defined extension points:
1. `src/components/Sidebar.tsx` and `src/components/MobileNav.tsx` for navigation.
2. `src/App.tsx` for state management and page rendering.
3. `src/types/index.ts` and `src/services/dbService.ts` for data models and Firestore operations.
4. `src/server/apiMiddleware.ts` for Gemini AI vision processing via `@google/genai`.
5. `firestore.rules` for document security.
6. `tests/regressions.test.ts` and `src/utils/testRunner.ts` for automated test coverage.

Full architectural mapping, component diagrams, and line-level references have been written to:
`c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_survey_1\survey_architecture.md`.

---

## 5. Verification Method

To independently verify the observations and findings in this report:
1. **Verify Test Suite**:
   ```powershell
   npm test
   ```
   *Expected outcome:* 16 passing tests, 0 failures.
2. **Verify TypeScript Typings**:
   ```powershell
   npm run lint
   ```
   *Expected outcome:* Clean exit code 0 (`tsc --noEmit`).
3. **Inspect Navigation Definition**:
   Inspect lines 20–28 of `src/components/Sidebar.tsx` and lines 20–77 of `src/components/MobileNav.tsx`.
4. **Inspect Route Switching**:
   Inspect lines 466–563 of `src/App.tsx`.
5. **Inspect Detailed Survey**:
   Open and view `c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_survey_1\survey_architecture.md`.
