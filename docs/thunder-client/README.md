# Bank Management System – API Collections & Demo Guide

This folder contains the Thunder Client collections used to test and demonstrate all features for Sprint 1 and Sprint 2.

## Prerequisites
- Node.js (v18+) and npm
- PostgreSQL database configured and running
- Backend dependencies installed (`npm install` in `backend/`)
- Backend server running (`npm start` in `backend/`)
- VS Code with **Thunder Client** extension installed

---

## Collections Available
- `Bank-Management-System-Sprint-1.json`: Sprint 1 Foundation & Security features
- `Bank-Management-System-Sprint-2.json`: Sprint 2 Banking features and operational endpoints

---

## How to Import in VS Code (Thunder Client)
1. Open VS Code in the project root.
2. In the left activity bar, click the **Thunder Client** icon (lightning bolt).
3. Click on the **Collections** tab.
4. Click the menu icon (`...`) next to Collections and select **Import**.
5. Select `docs/thunder-client/Bank-Management-System-Sprint-2.json` (and `Bank-Management-System-Sprint-1.json` if needed).
6. The collection `Bank Management System - Sprint 2` will appear with all requests numbered in recording order.

---

## Backend Base URL & TLS
- Base URL: `https://localhost:3443` (TLS 1.2+ HTTPS)
- Or `http://localhost:3000` if running with HTTP fallback in development.

> **Note on Self-Signed Certificates:**
> In Thunder Client settings (`Thunder Client -> Settings`), ensure **SSL Certificate Validation** is unchecked or ignore self-signed certs for `localhost`.

---

## Sprint 2 Demo Recording Checklist (Mapped to Merged PRs)

Follow this numbered sequence to screen record the working demo for Sprint 2:

| No. | Request Name | Feature ID | Merged PR | What to Observe / Expected Result |
|---|---|---|---|---|
| **01** | `01 - Manager - Activate Account` | BMS-F-007 | PR #46 | Account status changes to `ACTIVE` (200 OK), triggers customer activation email |
| **02** | `02 - Cash Deposit and Balance Update` | BMS-F-008 | PR #50 | Amount deposited, balance incremented, receipt returned with `referenceNumber` (201 Created) |
| **03** | `03 - Cash Withdrawal - Balance Check` | BMS-F-009 | PR #50 | Amount withdrawn, balance deducted, receipt returned (201 Created) |
| **04** | `04 - Withdrawal Rejection - Insufficient Balance` | BMS-F-009 | PR #50 | Rejection with `400 Bad Request` ("Insufficient balance") |
| **05** | `05 - Withdrawal Rejection - Daily Limit Exceeded` | BMS-F-009 | PR #50 | Rejection with `400 Bad Request` ("Withdrawal exceeds daily limit") |
| **06** | `06 - Unique Transaction Receipt Fetch` | BMS-F-010 | PR #50 | Fetches receipt details by `referenceNumber` (200 OK) |
| **07** | `07 - Intra-Bank Transfer - Low-Value Direct` | BMS-F-011 | PR #46 | Immediate transfer execution without OTP (< ₹10,000 threshold) (200 OK) |
| **08** | `08 - Intra-Bank Transfer - High-Value OTP Required` | BMS-F-012 | PR #46 | ≥ ₹10,000 triggers OTP verification challenge: `requiresOtp: true` (200 OK) |
| **09** | `09 - Verify Transfer OTP` | BMS-F-012 | PR #46 | Transfer completes atomically after OTP verification (200 OK) |
| **10** | `10 - Daily Transfer Limit Enforcement` | BMS-F-013 | PR #46 | Transfer exceeding daily allowance rejected with remaining limit (400 Bad Request) |
| **11** | `11 - Loan Application Submission` | BMS-F-014 | PR #46 | Customer submits loan application with amount, tenure & purpose (201 Created, `SUBMITTED`) |
| **12** | `12 - Customer Loan Status Check` | BMS-F-014 | PR #46 | Customer tracks application status using loan reference (200 OK) |
| **13** | `13 - Manager - View Pending Loans` | BMS-F-015 | PR #46 | Manager views pending loan applications queue (200 OK) |
| **14** | `14 - Manager - Loan Approval & Customer Notification` | BMS-F-015, BMS-F-016 | PR #46 | Manager approves with remarks, customer notified via email (200 OK) |
| **15** | `15 - Mini-Statement (Last 10 Transactions)` | BMS-F-017 | PR #46 | Shows recent 10 transactions labeled DEBIT/CREDIT with current balance (200 OK) |
| **16** | `16 - Full Account Statement for Date Range` | BMS-F-017 | PR #46 | Comprehensive transaction statement for date range (200 OK) |
| **17** | `17 - Admin - Create Staff User` | BMS-F-018 | PR #46 | Administrator creates new Teller/Manager account (201 Created) |
| **18** | `18 - Admin - Update User Role` | BMS-F-018, BMS-SR-004 | PR #38, PR #46 | RBAC role transition with audit log recording (200 OK) |
| **19** | `19 - Admin - List All Users` | BMS-F-018 | PR #46 | Admin queries complete staff & user registry (200 OK) |
| **20** | `20 - Periodic Banking Reports (JSON)` | Reporting | PR #48 | Generates transaction and banking activity periodic report (200 OK) |
| **21** | `21 - Admin - Tamper-Resistant Audit Log Verification` | BMS-SR-004, Audit | PR #43, PR #49 | Cryptographic SHA-256 hash chain verification: `verified: true` (200 OK) |

---

## Authentication Instructions for Screen Recording
1. Obtain tokens using the Sprint 1 collection (`Customer Login` + `OTP Verification` and `Manager Login` + `OTP Verification`).
2. Paste the customer's JWT in the **Auth -> Bearer Token** field of requests `02-12` and `15-16`.
3. Paste the manager's JWT in **Auth -> Bearer Token** for requests `01`, `13-14`, and `20`.
4. Paste the admin's JWT in **Auth -> Bearer Token** for requests `17-19` and `21`.
