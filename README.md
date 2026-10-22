Team Number - 13 Project Title - Bank Management System

Team Members:

Aditi Agarwal (PES2UG24CS029)

Abhiroop (PES2UG24CS024)

Aarush Khullar (PES2UG24CS014)

Amilineni Sai Dhyan Anubhav (PES2UG24CS055)

## Sprint 1 Features

### Customer Registration (BMS-F-001)
- Customer registration endpoint at POST /auth/register
- Validation for required fields and duplicate detection
- Audit logging for registration events

### Password Security (BMS-SR-002)
- Bcrypt password hashing with 12 salt rounds
- No plaintext password storage

### TLS 1.2 Enforcement (BMS-SR-001)
- HTTPS server with TLS 1.2 minimum version
- Disabled insecure protocols

## Setup

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm start
```

For HTTPS: `ENABLE_HTTPS=true npm start`

See backend/SECURITY.md for details.
