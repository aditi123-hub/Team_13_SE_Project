# Security Implementation

## Customer Registration (BMS-F-001)

Endpoint: POST /auth/register

**Required fields:**
- fullName
- email
- password
- Either mobile or governmentIdNum

**Features:**
- Email format validation
- Password minimum 8 characters
- Duplicate detection for email, mobile, government ID
- Audit logging

**Test:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "mobile": "1234567890",
    "governmentIdNum": "GOV123",
    "password": "password123"
  }'
```

## Password Hashing (BMS-SR-002)

- Bcrypt with 12 salt rounds
- No plaintext password storage
- No passwords in logs

Implementation:
```javascript
const saltRounds = 12;
const passwordHash = await bcrypt.hash(password, saltRounds);
```

## TLS 1.2 Enforcement (BMS-SR-001)

**Configuration:**
- Minimum version: TLS 1.2
- Maximum version: TLS 1.3
- Disabled: SSLv2, SSLv3, TLSv1.0, TLSv1.1

**Setup:**
```bash
# Generate development certificates
bash generate-certs.sh

# Start with HTTPS
ENABLE_HTTPS=true npm start
```

**Environment variables:**
```env
ENABLE_HTTPS=true
HTTPS_PORT=3443
SSL_KEY_PATH=./certs/server-key.pem
SSL_CERT_PATH=./certs/server-cert.pem
```

## Database Migration

After pulling changes:
```bash
npx prisma migrate dev
npx prisma generate
```

## Production Checklist

- Use CA-signed certificates
- Set ENABLE_HTTPS=true
- Configure strong JWT_SECRET
- Update DATABASE_URL
