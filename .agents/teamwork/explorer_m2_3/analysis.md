# Milestone 2 Explorer 3 Analysis: Frontend API Client & Fallback Error Strategy

**Objective**: Investigate and design the client API service function `scanInventoryImage` in `src/services/apiService.ts`, error response normalization, 429 rate limit handling, network timeout resilience (25s), mock test fixtures, and manual entry fallback flows for AquaPlus Service OS Inventory Management.

---

## 1. Architectural Context & Existing Patterns

### 1.1 Existing `src/services/apiService.ts` Patterns
An analysis of `src/services/apiService.ts` reveals key conventions already established in the codebase:
1. **Dynamic URL Resolution**:
   - `getApiBaseUrl()` reads from `localStorage` (`aquaplus_api_base_url`) or `import.meta.env.VITE_API_BASE_URL`.
   - `canUseBackendApi()` checks `!!getApiBaseUrl() || (typeof window !== 'undefined' && isHttpProtocol(window.location.protocol))`. In native Capacitor Android shells, `window.location.protocol` is `capacitor:` or `file:`, meaning an explicit base URL in `AppSettings` is required.
   - `resolveApiUrl(path: string)` ensures paths are correctly resolved whether relative (web same-origin) or absolute (Capacitor pointing to deployed backend).
2. **Firebase Auth Integration**:
   - `const token = await auth.currentUser?.getIdToken();`
   - Tokens are attached as `Authorization: Bearer ${token}`.
   - Unauthenticated or non-owner callers are stopped with clear errors.
3. **HTML Detection on Proxy/Routing Errors**:
   - When Vite development server or Cloudflare/Nginx proxies return HTML error pages (e.g. `<!doctype html>`), endpoints detect `text.startsWith('<!doctype') || text.startsWith('<html')` and reject early rather than failing with cryptic JSON parse errors.

### 1.2 Domain Contract Alignment (`PROJECT.md`)
The scan request and response structures are defined as follows:
```typescript
// Request Payload: POST /api/inventory/scan
export interface InventoryScanRequest {
  imageBase64: string;
  mimeType: string;
}

// Response Payload
export interface ScannedItemSuggestion {
  name: string;
  category: InventoryCategory;
  quantity: number;
  unitCost?: number;
  sellingPrice?: number;
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
  matchedItemId?: string;
  action?: 'add_new' | 'increment_existing' | 'skip';
}

export interface InventoryScanResult {
  scanType: 'physical_parts' | 'supplier_invoice' | 'unrecognized';
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  items: ScannedItemSuggestion[];
  rawSummary?: string;
  error?: string;
}
```

---

## 2. Detailed Design of `scanInventoryImage`

### 2.1 Function Signature & Options
```typescript
export interface InventoryScanOptions {
  timeoutMs?: number; // Defaults to 25_000 (25 seconds)
  signal?: AbortSignal; // Optional caller-provided cancellation signal
  authToken?: string; // Optional override for testing or background execution
}

export async function scanInventoryImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  options?: InventoryScanOptions
): Promise<InventoryScanResult>
```

### 2.2 Input Sanitization
1. **Base64 Prefix Cleansing**:
   Client captures or file readers often return data URLs (e.g., `data:image/jpeg;base64,/9j/4AAQSk...`).
   `scanInventoryImage` detects if `imageBase64` starts with `data:` and strips the prefix, extracting the MIME type if not explicitly supplied, ensuring the backend receives raw base64 data.
2. **MIME Type Normalization**:
   Trims and lowercases the MIME type. Defaults to `'image/jpeg'` if absent or unsupported.
3. **Empty/Whitespace Guard**:
   Throws `InventoryScanError` with code `'INVALID_REQUEST'` if `imageBase64` is missing, blank, or malformed.

### 2.3 Authentication & Shell Readiness
1. **Backend URL Verification**:
   If `!canUseBackendApi()`, throws `InventoryScanError` with code `'BACKEND_NOT_CONFIGURED'`:
   `"Backend API URL is required in the Android app. Open Settings, enter the deployed HTTPS backend URL, and save it."`
2. **Auth Token Retrieval**:
   Uses `options?.authToken` or retrieves `await auth.currentUser?.getIdToken()`.
   If missing, throws `InventoryScanError` with code `'UNAUTHORIZED'`:
   `"Sign in with an authorized owner account before scanning inventory items."`

### 2.4 Resilient 25-Second Timeout & Abort Handling
Vision AI models and payload transfers over mobile networks can encounter latency. A 25-second client timeout prevents the UI from freezing indefinitely:
- Creates an `AbortController`.
- Schedules a timer for `options?.timeoutMs ?? 25_000`.
- Listens to caller's `options?.signal` (e.g., technician clicks "Cancel" in modal) and aborts immediately.
- In `finally`, removes listeners and clears the timeout.
- If aborted due to timeout, throws `InventoryScanError` with code `'TIMEOUT'` and `canRetry: true`:
  `"Image scan timed out after 25 seconds. Please check your network connection or enter items manually."`

---

## 3. Comprehensive Error Normalization & Categorization

To support clean UI alert states and automated fallback paths, all errors are normalized into `InventoryScanError`:

```typescript
export type InventoryScanErrorCode =
  | 'BACKEND_NOT_CONFIGURED'
  | 'UNAUTHORIZED'
  | 'QUOTA_EXCEEDED'
  | 'SERVICE_UNAVAILABLE'
  | 'SERVER_ERROR'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_REQUEST'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'CANCELLED';

export class InventoryScanError extends Error {
  readonly code: InventoryScanErrorCode;
  readonly statusCode?: number;
  readonly canRetry: boolean;

  constructor(
    message: string,
    code: InventoryScanErrorCode,
    statusCode?: number,
    canRetry: boolean = false
  ) {
    super(message);
    this.name = 'InventoryScanError';
    this.code = code;
    this.statusCode = statusCode;
    this.canRetry = canRetry;
  }
}
```

### 3.1 HTTP Error Matrix & User-Friendly Messages

| Status Code | Error Code | Can Retry? | User-Facing Message | Fallback UX Action |
|-------------|------------|------------|---------------------|--------------------|
| 401 / 403 | `UNAUTHORIZED` | No | "Authentication required. Sign in with an authorized owner account or enter items manually." | Prompt login or direct to Manual Item Modal |
| 429 | `QUOTA_EXCEEDED` | Yes | "AI scan quota temporarily exhausted. Please wait a moment or enter manually." | Display "Switch to Manual Entry" button + 60s cooldown indicator |
| 503 | `SERVICE_UNAVAILABLE` | No | "AI vision service is currently unavailable. Please verify API configuration or enter items manually." | Display "Enter Manually" button |
| 500 / 502 | `SERVER_ERROR` | Yes | "AI scan failed due to a server error. Please try again or switch to manual entry." | "Retry" and "Enter Manually" buttons |
| 413 | `PAYLOAD_TOO_LARGE` | No | "Image file is too large. Please take a closer photo or use a smaller image." | Prompt retake with client-side compression |
| 400 | `INVALID_REQUEST` | No | "Invalid image or scan request. Please provide a clear spare parts photo or bill." | Prompt photo retake |
| Timeout | `TIMEOUT` | Yes | "Image scan timed out after 25 seconds. Please check your network connection or enter items manually." | "Retry" and "Enter Manually" buttons |
| Network Fail | `NETWORK_ERROR` | Yes | "Unable to connect to backend server. Check your connection or enter items manually." | "Enter Manually" button |
| HTML Proxy | `INVALID_RESPONSE` | No | "Backend server unavailable (returned HTML). Check API URL configuration or enter items manually." | Check settings / Enter manually |

### 3.2 Unreadable & Blurry Images (`scanType: 'unrecognized'`)
When the uploaded image does not contain recognizable water purifier parts or a bill, Gemini returns a valid 200 response with `scanType: 'unrecognized'`.
- `scanInventoryImage` normalizes this response and ensures `items: []`.
- If `error` was not populated by the server, it sets:
  `"Image could not be identified as water purifier spare parts or a supplier bill. Please ensure good lighting and clear text, or enter items manually."`
- The promise resolves successfully (does not throw) because this is a valid semantic assessment. The UI can inspect `result.scanType === 'unrecognized'` and display the guidance message with options: "Retake Photo" or "Enter Manually".

### 3.3 Helper Utilities
To simplify UI component logic:
```typescript
export function isQuotaExceededError(error: unknown): boolean;
export function isAuthError(error: unknown): boolean;
export function isNetworkOrTimeoutError(error: unknown): boolean;
export function getScanErrorMessage(error: unknown): string;
```

---

## 4. Mock Fixtures for CI and Testing

To ensure 100% CI reproducibility without external Gemini API keys or live network calls, we provide dedicated fixtures in `src/services/inventoryScanFixtures.ts`.

### 4.1 Mock Fixture Dataset
1. **`MOCK_PHYSICAL_PARTS_SCAN_RESULT`**:
   - RO Spun Filter (qty: 4, unitCost: ₹45, confidence: 'high')
   - Filmtec RO Membrane (qty: 2, unitCost: ₹850, confidence: 'high')
   - Kemflo Flow Restrictor (qty: 3, unitCost: ₹65, confidence: 'medium')
2. **`MOCK_INVOICE_SCAN_RESULT`**:
   - Supplier: Sri Murugan Water Tech & Spares, Madurai
   - Invoice: INV-2026-0842, Date: 2026-11-05
   - 4 line items: PP Spun Filter 10" (qty: 50, unitCost: ₹38), Vontron Membrane (qty: 10, unitCost: ₹780), Booster Pump 24V (qty: 5, unitCost: ₹1,150), SMPS Adapter 24V (qty: 8, unitCost: ₹260).
3. **`MOCK_UNRECOGNIZED_SCAN_RESULT`**:
   - `scanType: 'unrecognized'`, `items: []`, helpful guidance message.
4. **`createMockScanFetch(scenario, delayMs)`**:
   - Standalone fetch interceptor simulating all 9 HTTP scenarios (success, unrecognized, 401, 403, 413, 429, 500, 503, timeout, HTML).

---

## 5. Implementation Instructions for Worker

The Worker will implement:
1. `src/services/inventoryScanFixtures.ts`: Full mock data and `createMockScanFetch` utility.
2. `src/services/apiService.ts`:
   - Add imports from `../types`.
   - Export `InventoryScanError`, `InventoryScanErrorCode`, `InventoryScanOptions`.
   - Implement and export `scanInventoryImage`.
   - Export error helper functions (`isQuotaExceededError`, `isAuthError`, `isNetworkOrTimeoutError`, `getScanErrorMessage`).
3. `tests/regressions.test.ts`:
   - Unit tests covering all 11 scan client scenarios.
