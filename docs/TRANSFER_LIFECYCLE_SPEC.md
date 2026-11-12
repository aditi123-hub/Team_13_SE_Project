# Intra-Bank Funds Transfer & Security Lifecycle Specification

**Module Owner:** Amilineni Sai Dhyan Anubhav (`saidhyan45-coder`)  
**SRS Reference:** BMS-F-011, BMS-F-012, BMS-F-013, BMS-SR-003, BMS-SR-004  
**Sprint:** Sprint 2 – Banking Features  

---

## 1. Overview & Architecture

The funds transfer pipeline enforces strict ACID atomicity, daily limits, and dynamic multi-factor authentication (MFA) challenges before executing balance debits and credits across accounts.

```
       [Customer Transfer Request]
                  │
                  ▼
       [Input Sanitization & Account Validation]
                  │
                  ├── Account Active Check
                  ├── Self-Transfer Prevention Check
                  └── Sufficient Balance Validation
                  │
                  ▼
       [Daily Limit Enforcement (BMS-F-013)]
                  │
                  ├── Current Day Cumulative Volume + Amount <= 50,000 INR
                  └── If Exceeded: Return 400 Bad Request
                  │
                  ▼
       [Dynamic OTP Security Challenge (BMS-F-012)]
                  │
                  ├── Amount >= 10,000 INR?
                  │     ├── YES: Dispatch SMS OTP & Require Verification
                  │     └── NO: Proceed directly to Atomic Ledger Execution
                  │
                  ▼
       [Atomic Double-Entry Ledger Execution]
                  │
                  ├── Lock Sender & Receiver Balances
                  ├── Debit Source Account (Atomic decrement)
                  ├── Credit Target Account (Atomic increment)
                  └── Generate Cryptographic Receipt (TXN-XXXXXX)
                  │
                  ▼
       [Tamper-Resistant Audit Log Chaining (BMS-SR-004)]
                  │
                  └── Compute SHA-256(PredecessorHash + CurrentEvent)
```

---

## 2. Dynamic OTP Verification Matrix

| Transfer Amount (INR) | 2FA Required? | Verification Mechanism | Fallback Policy |
| :--- | :--- | :--- | :--- |
| **₹1.00 – ₹9,999.99** | No | Bearer JWT Token + Active Session | Instant Settlement |
| **≥ ₹10,000.00** | Yes | 6-digit Time-based SMS OTP (`/auth/transfer-otp`) | Transaction Pending until 2FA Validation |

---

## 3. Daily Limit Reset Mechanics

1. Limits reset at midnight **00:00:00 UTC** daily.
2. Only `COMPLETED` transactions are counted toward the cumulative volume threshold.
3. Failed, reversed, or pending transactions do not decrement the remaining daily allowance.
