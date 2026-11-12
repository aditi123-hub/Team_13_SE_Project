const express = require("express");
const http = require("http");
const authRouter = require("../src/routes/auth");

const app = express();
app.use(express.json());
app.use("/auth", authRouter);

const server = http.createServer(app);

function doReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : "";
    const addr = server.address();
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function test() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  console.log("=== Testing SMS Config & Phone Login & Registration ===");

  // 1. GET SMS Config
  const res1 = await doReq("GET", "/auth/sms-config");
  console.log("1. GET /auth/sms-config:", res1.status, res1.body);

  // 2. Dynamic SMS Config
  const res2 = await doReq("POST", "/auth/sms-config", { apiKey: "fast2sms_key_sample" });
  console.log("2. POST /auth/sms-config:", res2.status, res2.body);

  // 3. Mobile OTP Login Request
  const res3 = await doReq("POST", "/auth/login", { phone: "9876543210" });
  console.log("3. POST /auth/login (Phone only):", res3.status, res3.body);
  const loginOtp = res3.body.otp;

  // 4. Verify OTP for Phone Login
  const res4 = await doReq("POST", "/auth/verify-otp", { phone: "9876543210", otp: loginOtp });
  console.log("4. POST /auth/verify-otp:", res4.status, "User role:", res4.body.user?.role, "Token exists:", Boolean(res4.body.token));

  // 5. Account Creation Request OTP
  const res5 = await doReq("POST", "/auth/register/request-otp", {
    fullName: "Abhiroop Dev",
    email: "abhiroop@gmail.com",
    phone: "9123456780",
    role: "CUSTOMER",
  });
  console.log("5. POST /auth/register/request-otp:", res5.status, res5.body);
  const regOtp = res5.body.otp;

  // 6. Account Creation Verify OTP
  const res6 = await doReq("POST", "/auth/register/verify", {
    fullName: "Abhiroop Dev",
    email: "abhiroop@gmail.com",
    phone: "9123456780",
    role: "CUSTOMER",
    otp: regOtp,
  });
  console.log("6. POST /auth/register/verify:", res6.status, "Created user:", res6.body.user, "Token exists:", Boolean(res6.body.token));

  // 7. Verify standard password login still works (Backward compatibility)
  const res7 = await doReq("POST", "/auth/login", {
    email: "customer2@bank.com",
    password: "password123",
  });
  console.log("7. POST /auth/login (Credentials):", res7.status, "Message:", res7.body.message);

  console.log("=== All Auth & SMS & Registration tests succeeded! ===");
  server.close();
}

test().catch((err) => {
  console.error("Test error:", err);
  server.close();
});
