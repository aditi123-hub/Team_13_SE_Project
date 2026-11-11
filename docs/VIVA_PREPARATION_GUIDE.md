# Sprint 2 – Viva & Oral Examination Guide
**Team Number:** 13  
**Project:** Bank Management System  

---

## 1. Member Contribution & PR Breakdown

### Aditi Agarwal (PES2UG24CS029)
* **Core Responsibilities:** Sprint 1 Foundations, KYC Review Workflow & Role-Based Security.
* **Key PRs:** PR #38 (Role update & security), KYC processing, Customer Auth.
* **Talking Points:**
  - Designed the role hierarchy (`ADMIN`, `MANAGER`, `CUSTOMER`, `TELLER`).
  - Explain how KYC documents transition from `PENDING` to `APPROVED`, automatically creating customer savings accounts.
  - Justify why salted Bcrypt hashing with 12 rounds protects against rainbow tables and offline attacks.

### Abhiroop (PES2UG24CS024)
* **Core Responsibilities:** Sprint 2 End-to-End Integration, Thunder Client Collections & Dashboard UI.
* **Key Deliverables:** 21-request Thunder Client collection (`Bank-Management-System-Sprint-2.json`), Minimalist Black-and-White Dashboard (`frontend/src/App.jsx`), Integration resilience.
* **Talking Points:**
  - Explain the 21 API requests demonstrating all merged PRs in sequence.
  - Explain how the dashboard connects to live endpoints (Deposit, Withdraw, Transfer with OTP, Loan status, Admin verification).
  - Describe the idempotency enhancements ensuring demo stability and repeat takes.

### Aarush Khullar (PES2UG24CS014)
* **Core Responsibilities:** Cash Operations (Deposit, Withdraw, Receipts) & Daily Limits.
* **Key PRs:** PR #50 (`BMS-F-008`, `BMS-F-009`, `BMS-F-010`).
* **Talking Points:**
  - How cash deposits atomically increment account balances and record receipt metadata.
  - How daily withdrawal limits (₹50,000/day) are enforced by aggregating completed withdrawals for the current calendar day.
  - Explain transaction receipts fetched by unique reference number (`DEP-XXXX`, `WDR-XXXX`).

### Amilineni Sai Dhyan Anubhav (PES2UG24CS055)
* **Core Responsibilities:** Funds Transfer Engine, Two-Factor Authentication & Audit Logging.
* **Key PRs:** PR #46 (`BMS-F-011`, `BMS-F-012`, `BMS-F-013`, `BMS-F-014`, `BMS-F-017`), PR #43 & #49 (Audit chain).
* **Talking Points:**
  - How transfers execute atomically within a Prisma database transaction so debits and credits cannot become desynchronized.
  - How two-factor OTP challenges trigger dynamically for transfers ≥ ₹10,000.
  - How the SHA-256 cryptographic audit chain prevents log tampering by linking each log entry to the hash of its predecessor.

---

## 2. Architectural Justifications & Defense

1. **Why TLS 1.2+ minimum?**
   - Disables vulnerable older ciphers (SSLv3, TLS 1.0, TLS 1.1) vulnerable to POODLE and BEAST attacks.
2. **Why SHA-256 hash chaining for audit logs?**
   - Implements a blockchain-style hash pointer: if an attacker modifies an old log record, every subsequent record hash fails validation, proving tampering immediately.
3. **Why atomic database transactions for transfers?**
   - If a debit succeeds but the credit fails, money is lost. Atomic transactions guarantee ACID properties (all-or-nothing execution).
4. **Why two-step transfer threshold?**
   - Balances user convenience for low-value payments (< ₹10,000) with strong 2FA security for high-value transactions.
