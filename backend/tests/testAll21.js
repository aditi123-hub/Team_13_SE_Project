const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const collectionPath = path.resolve(__dirname, "../../docs/thunder-client/Bank-Management-System-Sprint-2.json");
const collection = JSON.parse(fs.readFileSync(collectionPath, "utf8"));

const serverProcess = spawn("node", ["src/server.js"], {
  cwd: path.resolve(__dirname, ".."),
  env: { ...process.env, ENABLE_HTTPS: "true" },
  stdio: "ignore",
});

setTimeout(async () => {
  console.log("Testing all " + collection.requests.length + " requests in sequence...\n");
  let failed = 0;

  for (let i = 0; i < collection.requests.length; i++) {
    const reqData = collection.requests[i];
    const url = new URL(reqData.url);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: reqData.method,
      rejectUnauthorized: false,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + reqData.auth.bearer,
      },
    };

    const res = await new Promise((resolve) => {
      const r = https.request(options, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });
      r.on("error", (e) => resolve({ error: e.message }));
      if (reqData.body && reqData.body.raw) {
        r.write(reqData.body.raw);
      }
      r.end();
    });

    const isExpected = res.status === 200 || res.status === 201;

    const padName = reqData.name.slice(0, 48).padEnd(48);
    console.log(`[${String(i + 1).padStart(2, "0")}] ${padName} -> Status: ${res.status} | OK: ${isExpected}`);
    if (!isExpected) {
      console.log("   FAILED BODY:", res.body);
      failed++;
    }
  }

  console.log(`\nResults: ${collection.requests.length - failed}/${collection.requests.length} passed.`);
  serverProcess.kill();
  process.exit(failed > 0 ? 1 : 0);
}, 3500);

