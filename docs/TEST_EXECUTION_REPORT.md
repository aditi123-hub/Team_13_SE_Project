# Sprint 2 – Automated Test Execution Report
**Project:** Bank Management System (Team 13)  
**Date of Execution:** 11 November 2026  
**Test Framework:** Node.js Native Test Runner (`node --test`)  
**Status:** ALL TESTS PASSED (100% Pass Rate)

---

## 1. Test Summary

| Test Suite File | Test Cases Executed | Passed | Failed | Execution Time |
|---|---|---|---|---|
| `backend/tests/sprint2BankingFeatures.test.js` | 6 | 6 | 0 | 720 ms |
| `backend/tests/testAll21.js` (End-to-End API Suite) | 21 | 21 | 0 | 2,800 ms |
| `frontend/tests/accessibility.spec.js` | Playwright A11y Suite | Passed | 0 | Clean |

---

## 2. Unit Test Results (`sprint2BankingFeatures.test.js`)

```text
✔ Deposit route: successfully records deposit and updates balance (8.75ms)
✔ Withdrawal route: rejects if insufficient balance (1.10ms)
✔ Loan application route: submits loan with SUBMITTED status (0.66ms)
✔ Mini statement route: returns last 10 transactions with direction (0.67ms)
✔ Transfer route: low-value transfer completes directly (0.96ms)
✔ Admin create user route: creates a new user successfully (216.92ms)

Total Tests: 6
Pass: 6
Fail: 0
Duration: 720ms
```

---

## 3. End-to-End API Integration Suite (`testAll21.js`)

All 21 Thunder Client requests mapped to merged Sprint 2 PRs:

```text
[01] 01 - Manager - Activate Account               -> Status: 200 OK  [PASSED]
[02] 02 - Cash Deposit and Balance Update          -> Status: 201 Created [PASSED]
[03] 03 - Cash Withdrawal - Balance Check          -> Status: 201 Created [PASSED]
[04] 04 - Withdrawal Rejection - Insufficient Bal  -> Status: 200 OK  [PASSED]
[05] 05 - Withdrawal Rejection - Daily Limit Exceeded -> Status: 200 OK  [PASSED]
[06] 06 - Unique Transaction Receipt Fetch         -> Status: 200 OK  [PASSED]
[07] 07 - Intra-Bank Transfer - Low-Value Direct   -> Status: 200 OK  [PASSED]
[08] 08 - Intra-Bank Transfer - High-Value OTP Req -> Status: 200 OK  [PASSED]
[09] 09 - Verify Transfer OTP                      -> Status: 200 OK  [PASSED]
[10] 10 - Daily Transfer Limit Enforcement         -> Status: 200 OK  [PASSED]
[11] 11 - Loan Application Submission              -> Status: 201 Created [PASSED]
[12] 12 - Customer Loan Status Check               -> Status: 200 OK  [PASSED]
[13] 13 - Manager - View Pending Loans             -> Status: 200 OK  [PASSED]
[14] 14 - Manager - Loan Approval & Customer Notif -> Status: 200 OK  [PASSED]
[15] 15 - Mini-Statement (Last 10 Transactions)    -> Status: 200 OK  [PASSED]
[16] 16 - Full Account Statement for Date Range    -> Status: 200 OK  [PASSED]
[17] 17 - Admin - Create Staff User                -> Status: 201 Created [PASSED]
[18] 18 - Admin - Update User Role                 -> Status: 200 OK  [PASSED]
[19] 19 - Admin - List All Users                   -> Status: 200 OK  [PASSED]
[20] 20 - Periodic Banking Reports (JSON)          -> Status: 200 OK  [PASSED]
[21] 21 - Admin - Tamper-Resistant Audit Log Verif -> Status: 200 OK  [PASSED]

Final Verdict: 21 / 21 Passed (100%)
```

---

## 4. Frontend Build & Accessibility Quality Gate

```text
✓ vite build (Client Bundle Compiled in 136ms)
✓ oxlint (0 errors, 0 warnings across all files)
```
