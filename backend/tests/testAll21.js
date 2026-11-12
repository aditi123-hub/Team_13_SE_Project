const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const collectionPath = path.resolve(__dirname, "../../docs/thunder-client/Bank-Management-System-Sprint-2.json");
const collection = JSON.parse(fs.readFileSync(collectionPath, "utf8"));

const serverProcess = spawn("node", ["src/server.js"], {
  cwd: path.resolve(__dirname, ".."),
  env: { ...process.env, ENABLE_HTTPS: "true" },
  stdio: "inherit",
});

async function checkPort(port, isHttps) {
  return new Promise((resolve) => {
    const transport = isHttps ? https : http;
    const req = transport.request(
      {
        hostname: "localhost",
        port,
        path: "/api/health",
        method: "GET",
        rejectUnauthorized: false,
        timeout: 1000,
      },
      () => resolve(true)
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

setTimeout(async () => {
  let targetPort = 3443;
  let useHttps = true;

  const httpsUp = await checkPort(3443, true);
  if (!httpsUp) {
    const httpUp = await checkPort(3000, false);
    if (httpUp) {
      targetPort = 3000;
      useHttps = false;
    }
  }

  console.log(`Testing all ${collection.requests.length} requests against port ${targetPort} (${useHttps ? "HTTPS" : "HTTP"})...\n`);
  let failed = 0;

  for (let i = 0; i < collection.requests.length; i++) {
    const reqData = collection.requests[i];
    const url = new URL(reqData.url);
    const options = {
      hostname: "localhost",
      port: targetPort,
      path: url.pathname + url.search,
      method: reqData.method,
      rejectUnauthorized: false,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + reqData.auth.bearer,
      },
    };

    const transport = useHttps ? https : http;
    const res = await new Promise((resolve) => {
      const r = transport.request(options, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });
      r.on("error", (e) => resolve({ error: e.message, status: undefined }));
      if (reqData.body && reqData.body.raw) {
        r.write(reqData.body.raw);
      }
      r.end();
    });

    const isExpected = res.status === 200 || res.status === 201;

    const padName = reqData.name.slice(0, 48).padEnd(48);
    console.log(`[${String(i + 1).padStart(2, "0")}] ${padName} -> Status: ${res.status} | OK: ${isExpected}`);
    if (!isExpected) {
      console.log("   FAILED BODY:", res.body || res.error);
      failed++;
    }
  }

  console.log(`\nResults: ${collection.requests.length - failed}/${collection.requests.length} passed.`);
  serverProcess.kill();
  process.exit(failed > 0 ? 1 : 0);
}, 3500);

