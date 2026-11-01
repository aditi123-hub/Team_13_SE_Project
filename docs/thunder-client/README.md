# Bank Management System – Sprint 1 API Collection

This folder contains the Thunder Client collection used to test Sprint 1 APIs.

## Prerequisites
- Node.js and npm
- PostgreSQL database configured for the project
- Backend dependencies installed
- Backend server running
- Thunder Client VS Code extension

## Importing the Collection
1. Open the project in VS Code.
2. Install the Thunder Client extension.
3. Open Thunder Client.
4. Select Collections.
5. Import `Bank-Management-System-Sprint-1.json`.

## Backend Base URL
`https://localhost:3443`

The project uses a local self-signed HTTPS certificate. A certificate warning is expected during local testing.

## API Requests

| No. | Request | Purpose |
|---|---|---|
| 01 | Customer Registration | Register a new customer |
| 02 | Duplicate Registration | Verify duplicate registration rejection |
| 03 | Customer Login | Authenticate customer credentials |
| 04 | OTP Verification | Verify customer OTP |
| 05 | Account Lockout | Test failed-login lockout |
| 06 | RBAC - Customer Access Denied | Verify customer cannot access manager endpoint |
| 07 | Admin Login | Authenticate administrator |
| 08 | Admin OTP Verification | Verify administrator OTP |
| 09 | RBAC - Admin Access | Verify administrator access to audit logs |
| 10 | KYC Application | Submit customer KYC application |
| 11 | KYC Status Check | Check application status |
| 12 | Manager Login | Authenticate manager |
| 13 | Manager OTP Verification | Verify manager OTP |
| 14 | Manager - Pending KYC | View pending KYC applications |
| 15 | Manager - Approve KYC | Approve a KYC application |
| 16 | Admin - Audit Logs | Retrieve audit records |

## Authentication
- Registration and login requests do not require a bearer token.
- OTP verification uses the email and OTP received.
- Protected endpoints require a JWT in the Bearer Token field.
- Customer, Manager and Admin roles have different access permissions.
- JWTs expire after one hour in this project.

## Important Notes
- Replace `REPLACE_WITH_YOUR_VALUE` placeholders before running login and OTP requests.
- Configure the correct email addresses and credentials for your local database.
- Obtain fresh JWTs through login and OTP verification before accessing protected endpoints.
- Use the KYC reference number returned by the application request.
- The collection contains sanitized request configurations, not reusable authentication sessions.
- Never commit passwords, OTPs, JWTs, or private keys to GitHub.
