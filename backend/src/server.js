require("dotenv").config();
const express = require("express");
const https = require("https");
const { shouldAbortOnHttpsFailure } = require("./services/httpsStartupPolicy");
const fs = require("fs");
const tls = require("tls");
const authRoutes = require("./routes/auth");
const kycRoutes = require("./routes/kyc");
const auditLogRoutes = require("./routes/auditLogs");
const transferRoutes = require("./routes/transfers");
const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Middleware
app.use(express.json());
// Routes
app.use("/auth", authRoutes);
app.use("/kyc", kycRoutes);
app.use("/audit-logs", auditLogRoutes);
app.use("/transfers", transferRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Bank Management System backend is running",
    secure: req.secure,
    protocol: req.protocol,
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

// Start server with TLS 1.2 or higher enforcement (BMS-SR-001)
if (process.env.NODE_ENV === "production" || process.env.ENABLE_HTTPS === "true") {
  try {
    // Load SSL/TLS certificates
    const sslOptions = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH || "./certs/server-key.pem"),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH || "./certs/server-cert.pem"),
      // Enforce TLS 1.2 or higher (BMS-SR-001)
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.3",
      // Disable insecure protocols
      secureProtocol: "TLSv1_2_method",
      secureOptions: 
        tls.SSL_OP_NO_SSLv2 | 
        tls.SSL_OP_NO_SSLv3 | 
        tls.SSL_OP_NO_TLSv1 | 
        tls.SSL_OP_NO_TLSv1_1,
    };

    const httpsServer = https.createServer(sslOptions, app);

    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`HTTPS Server running securely at https://localhost:${HTTPS_PORT}`);
      console.log(`TLS 1.2+ enforced (BMS-SR-001 compliance)`);
    });
	  } catch (error) {
    console.error("Failed to start HTTPS server:", error.message);

    if (shouldAbortOnHttpsFailure(process.env.NODE_ENV)) {
      console.error("HTTPS is required in production. Server startup aborted.");
      process.exit(1);
    }

    console.log("Falling back to HTTP server (development only)");
    app.listen(PORT, () => {
      console.log(`HTTP Server running at http://localhost:${PORT}`);
      console.warn(
        "WARNING: Running in HTTP mode. HTTPS with TLS 1.2+ is required for production."
      );
    });
  }
} else {
  // Development mode - HTTP server
  app.listen(PORT, () => {
    console.log(`HTTP Server running at http://localhost:${PORT}`);
    console.warn("Development mode: Set ENABLE_HTTPS=true for TLS 1.2+ enforcement");
  });
}

module.exports = app;
