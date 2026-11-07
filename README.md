Team Number - 13
Project Title - Bank Management System

Team Members:
- Aditi Agarwal (PES2UG24CS029)
- Abhiroop (PES2UG24CS024)
- Aarush Khullar (PES2UG24CS014)
- Amilineni Sai Dhyan Anubhav (PES2UG24CS055)

---

## Sprint 1 - Core Foundations

### Customer Registration (BMS-F-001)
- `POST /auth/register` - register with name, email, mobile, government ID
- Duplicate detection for email, mobile, government ID
- Audit logging on registration

### Account Opening with KYC (BMS-F-005)
- `POST /kyc/apply` - submit account opening application with KYC documents
- Generates unique reference number, application stays pending until approved
- `GET /kyc/status/:referenceNumber` - check application status

### Manager KYC Approval (BMS-F-006)
- `GET /kyc/pending` - manager views all pending applications
- `GET /kyc/review/:id` - manager reviews application details
- `POST /kyc/decision/:id` - manager approves or rejects with reason
- Decision and manager identity recorded in audit log

### Salted One-Way Password Hashing (BMS-SR-002)
- Bcrypt with 12 salt rounds
- No plaintext passwords stored or logged

### Require TLS 1.2 or Higher (BMS-SR-001)
- HTTPS server with TLS 1.2 minimum, TLS 1.3 maximum
- SSLv2, SSLv3, TLS 1.0, TLS 1.1 explicitly disabled
- Set `ENABLE_HTTPS=true` to enable

### OTP Two-Factor Verification (BMS-SR-003)
- `POST /auth/login` - validates credentials and sends OTP
- `POST /auth/verify-otp` - verifies OTP and issues JWT
- OTP is purpose-scoped (login vs transfer), hashed in memory, expires in 5 minutes
- Max 5 attempts before OTP is invalidated

---

## Sprint 2 - Banking Features

### Account Activation Notification (BMS-F-007)
- `POST /accounts/:accountId/activate` - manager activates account
- Sends email notification to customer on activation

### Cash Deposit and Balance Update (BMS-F-008)
- `POST /accounts/:accountId/deposit` - record deposit and update balance
- Returns transaction receipt with reference number

### Withdrawal Balance and Daily Limit Checks (BMS-F-009)
- `POST /accounts/:accountId/withdraw` - process withdrawal
- Rejects if insufficient balance
- Rejects if daily withdrawal limit exceeded
- Returns transaction receipt

### Unique Transaction Receipt and Reference (BMS-F-010)
- `GET /accounts/receipt/:referenceNumber` - fetch receipt
- Only returns receipts for completed transactions
- Shows amount, type, timestamp, reference number

### Intra-Bank Funds Transfer (BMS-F-011)
- `POST /transfers/initiate` - transfer between accounts within the bank
- Validates source and destination accounts, debits and credits atomically

### OTP for High-Value Transfers (BMS-F-012)
- Transfers above threshold require OTP before completion
- `POST /transfers/verify-otp` - verify OTP to complete high-value transfer

### Daily Transfer Limit Enforcement (BMS-F-013)
- Rejects transfers that would exceed the configured daily limit
- Informs customer of remaining daily allowance

### Loan Application Submission (BMS-F-014)
- `POST /loans/apply` - submit loan application with amount and purpose
- Generates unique reference, available for manager review

### Loan Approval or Rejection with Remarks (BMS-F-015)
- `POST /loans/decision/:id` - manager approves or rejects with remarks
- Only authorized managers can make decisions

### Loan Decision Notification (BMS-F-016)
- Customer receives email notification after loan is approved or rejected
- Notification includes decision and remarks

### Mini-Statement and Full Statement (BMS-F-017)
- `GET /statements/:accountId/mini` - last 10 transactions
- `GET /statements/:accountId/full?from=&to=` - transactions within date range

### Staff and User Account Management (BMS-F-018)
- `POST /admin/users` - admin creates new user account
- `PATCH /admin/users/:userId/role` - admin updates user role
- `GET /admin/users` - admin lists all users
- All changes audit logged

---

## Setup

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma generate
npm start
```

For HTTPS: set `ENABLE_HTTPS=true` in `.env`

See `backend/SECURITY.md` for security configuration details.
