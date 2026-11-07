# Milestone 2 Explorer 3 Handoff Report: Frontend API Client & Fallback Error Strategy

## 1. Observation
1. **Existing API Client Patterns (`src/services/apiService.ts`)**:
   - Lines 6-8: `canUseBackendApi()` checks `!!getApiBaseUrl() || (typeof window !== 'undefined' && isHttpProtocol(window.location.protocol))` to detect web vs native Capacitor environments.
   - Lines 50-54: `resolveApiUrl(path: string)` resolves paths relative to `getApiBaseUrl()`.
   - Lines 73-79: `const token = await auth.currentUser?.getIdToken();` retrieves Firebase Auth tokens and attaches `Authorization: Bearer ${token}`.
   - Lines 81-83: Detects HTML responses (`text.startsWith('<!doctype') || text.startsWith('<html')`) from failing proxies or Vite fallbacks.
2. **Domain Contract (`PROJECT.md`)**:
   - Lines 86-110: Specifies the Gemini Vision scan contract:
     - `POST /api/inventory/scan`
     - Request: `{ imageBase64: string, mimeType: string }`
     - Response: `InventoryScanResult` containing `scanType` (`'physical_parts' | 'supplier_invoice' | 'unrecognized'`), `items: ScannedItemSuggestion[]`, `supplierName?`, `invoiceNumber?`, `invoiceDate?`, `rawSummary?`, `error?`.
   - Lines 221-350 of `src/types/index.ts`: Defines `InventoryCategory`, `isInventoryCategory`, `StockStatus`, `VisionConfidence`, `ScannedItemSuggestion`, `InventoryScanResult`, `InventoryScanRequest`.
3. **Server Endpoint & Rate Limiting (`src/server/apiMiddleware.ts`)**:
   - Lines 22-25: `RATE_LIMIT_WINDOW_MS = 60_000`, `RATE_LIMIT_MAX = 8`. When exceeded, returns HTTP 429 with `{ error: 'Too many API requests. Try again in a minute.' }` and `Retry-After: 60`.
   - Lines 30-48 & 173-178: Authenticates owner using `verifyIdToken` and checks `OWNER_EMAILS`. Returns 401/403 on failure.
   - Line 76: Existing `BODY_LIMIT_BYTES = 16_384` will be augmented by Explorer 1 for `/api/inventory/scan` to 10MB (`10 * 1024 * 1024`).
4. **Existing Regression Test Suite (`tests/regressions.test.ts`)**:
   - Executing `npm test` runs `tsx --test tests/regressions.test.ts` with 20 passing tests in 1847ms.

## 2. Logic Chain
1. **From Observation 1 & 2**: `scanInventoryImage` must live in `src/services/apiService.ts`, take `(imageBase64: string, mimeType: string = 'image/jpeg', options?: InventoryScanOptions)`, and return `Promise<InventoryScanResult>`.
2. **From Observation 1**: Because Capacitor mobile apps run under `capacitor://` or `file://`, calling `scanInventoryImage` when `canUseBackendApi()` is false must throw a typed error directing the user to enter the backend URL in Settings (`BACKEND_NOT_CONFIGURED`), preventing silent network failures.
3. **From Observation 1 & 3**: Authentication must retrieve `await auth.currentUser?.getIdToken()`. To support flexible testing and background execution without mutating global auth state, `options?.authToken` is supported as an optional parameter.
4. **From Observation 2 & Dispatch Task 1**: Image payloads from cameras or file inputs often come as Data URLs (`data:image/jpeg;base64,...`). `scanInventoryImage` must defensively strip the prefix so the server receives pure base64.
5. **From Dispatch Task 2**:
   - **401 Unauthorized**: Throws `InventoryScanError` with `code: 'UNAUTHORIZED'` and message: `"Authentication required. Sign in with an authorized owner account or enter items manually."`
   - **429 Quota Exceeded**: Throws `InventoryScanError` with `code: 'QUOTA_EXCEEDED'`, `canRetry: true`, and message: `"AI scan quota temporarily exhausted. Please wait a moment or enter manually."`
   - **503 Service Unavailable / Missing API Key**: Throws `InventoryScanError` with `code: 'SERVICE_UNAVAILABLE'`, `canRetry: false`, and message: `"AI vision service is currently unavailable. Please verify API configuration or enter items manually."`
   - **500 Server Error**: Throws `InventoryScanError` with `code: 'SERVER_ERROR'`, `canRetry: true`, and message: `"AI scan failed due to a server error. Please try again or switch to manual entry."`
   - **Timeout (25s)**: Implements an `AbortController` with a 25-second timer (`options?.timeoutMs ?? 25_000`) and caller abort listener. On timeout, throws `InventoryScanError` with `code: 'TIMEOUT'`, `canRetry: true`, and message: `"Image scan timed out after 25 seconds. Please check your network connection or enter items manually."`
   - **Unrecognized / Blurry Images**: Gemini returns HTTP 200 with `scanType: 'unrecognized'`. `scanInventoryImage` returns the result without throwing, ensuring `items: []` and setting a clear guidance message in `error`. The UI can present options to "Retake Photo" or "Enter Manually".
6. **From Dispatch Task 3**: CI environments cannot rely on live Gemini API keys or external networks. A dedicated mock fixture module `src/services/inventoryScanFixtures.ts` with `createMockScanFetch` allows deterministic, instantaneous testing of all 9 success and error scenarios in `tests/regressions.test.ts`.

## 3. Caveats
- `scanInventoryImage` relies on the server endpoint `POST /api/inventory/scan` implemented by Worker M2-1 (designed by Explorer M2-1). Until M2-1 merges, unit tests use `createMockScanFetch`.
- In native Capacitor shells, image compression is handled client-side before calling `scanInventoryImage` (designed by Explorer M2-2 in `src/utils/imageCompressor.ts`). `scanInventoryImage` accepts the base64 output of that compression.

## 4. Conclusion
The frontend API client and fallback error strategy is fully designed with:
1. `scanInventoryImage` in `src/services/apiService.ts` matching domain contracts, with data URL sanitization and Bearer token attachment.
2. Complete error normalization via `InventoryScanError` and helper predicates (`isQuotaExceededError`, `isAuthError`, `isNetworkOrTimeoutError`, `getScanErrorMessage`).
3. 25-second timeout with clean `AbortController` lifecycle.
4. Seamless manual entry fallback messages for 401, 429, 500, 503, unrecognized images, and timeouts.
5. Reusable mock fixtures in `src/services/inventoryScanFixtures.ts` and automated tests in `tests/regressions.test.ts`.
6. Complete code files ready for the Worker in `proposed_inventoryScanFixtures.ts`, `proposed_apiService_extension.ts`, and `proposed_regression_tests.ts`.

## 5. Verification Method
1. **Mock Verification**: Run `npm test` after adding the proposed regression tests. All 11 scan tests must pass synchronously.
2. **TypeScript Typecheck**: Run `npm run lint` (`tsc --noEmit`). No type errors.
3. **Invalidation Conditions**:
   - `scanInventoryImage` throws on `scanType: 'unrecognized'` instead of resolving with guidance.
   - HTTP 429 does not contain friendly quota message mentioning manual entry.
   - Timeout occurs past 25 seconds or fails to cancel timer on completion.
