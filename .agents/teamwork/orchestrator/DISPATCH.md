# Dispatch Log

## 2026-11-07T04:34:44Z
**Sender**: d0fd71db-abe9-4712-a84a-ade4d6775768 (Sentinel)
**Priority**: MESSAGE_PRIORITY_HIGH
**Content**:
Build a production inventory and storage management feature for the AquaPlus Service OS application to track spare parts and stock levels (e.g. RO spun filters, membranes), support manual entry and editing, and use AI vision to scan photos of spare parts and supplier invoices/bills to create inventory entries.

Integrity mode: development

## Verification Resources
- The user will provide sample photos of spare parts and supplier bills/invoices for testing the scanning feature.

## Requirements

### R1. Inventory Storage and Tracking
Provide an inventory management view in the AquaPlus Service OS application that displays the current stock of parts and supplies (including item names, categories such as spun filter and RO membrane, quantities in stock, and unit costs), highlighting items that reach low-stock thresholds.

### R2. Manual Entry and Stock Management
Allow users to manually add new items, edit existing item details, adjust stock quantities, and remove items when necessary.

### R3. Image Scanning for Inventory Entry
Allow users to take a photo or upload an image of physical spare parts or supplier bills/invoices, automatically analyze the image with Gemini Vision AI to identify items and quantities, and present the parsed data in an editable confirmation interface before updating inventory.

### R4. Application and Navigation Integration
Integrate the inventory management feature into the application's navigation structure (Sidebar and Mobile Navigation). The team may decide how parts usage links with service records.

## Acceptance Criteria

### Inventory Management
- [ ] Users can browse, search, and filter inventory items by category and stock status.
- [ ] Users can create new items, edit existing item fields, and update stock counts manually.
- [ ] Items with stock at or below their defined low-stock threshold show a visual warning or indicator.

### Image Scanning & Processing
- [ ] The user can capture an image via device camera or upload an image file from the device.
- [ ] The image scanning interface successfully submits images to Gemini Vision AI.
- [ ] Gemini Vision extracts item names, quantities, and pricing from photos of physical spare parts and supplier bills/invoices.
- [ ] Extracted items are presented in a review form allowing the user to review, edit, and confirm before items are added to inventory.

### Navigation & Integration
- [ ] The inventory view is accessible via both desktop Sidebar and mobile navigation bars.
- [ ] The inventory view functions cleanly in both desktop web browser and Capacitor mobile shell environments.

### Verification
- [ ] Automated tests verify CRUD operations for inventory items and stock adjustments.
- [ ] Automated tests verify image parsing response handling and fallback on unrecognized images.
- [ ] Verification passes using user-provided sample photos of spare parts and supplier bills/invoices.

---
Context & Instructions for Orchestrator:
- Your working directory: .agents/teamwork/orchestrator/
- Original request reference: .agents/teamwork/ORIGINAL_REQUEST.md
- You are the Project Orchestrator (teamwork_orchestrator). Dissect the requirements, coordinate specialist subagents, maintain your plan.md, progress.md, and BRIEFING.md.
- Ensure automated test suite covers the new features and everything compiles and verifies cleanly.
- When done, report completion to Sentinel.


## 2026-11-07T05:24:01Z
**Sender**: d0fd71db-abe9-4712-a84a-ade4d6775768 (Sentinel)
**Priority**: MESSAGE_PRIORITY_HIGH
**Content**:
CRITICAL PATH & REPOSITORY REMINDER FROM USER:
1. Work strictly inside "C:\Users\nisan\Downloads\aquaplus-service".
2. DO NOT reference, recreate, copy, or junction any folder named "aquaplus-service-os". That folder has been permanently removed.
3. The only valid git remote is "https://github.com/yuriboyka01/Aqua-Plus-App.git". Never push or link to "Aqua-plus.git".
Please ensure all workers, scripts, and tests adhere strictly to these rules.
