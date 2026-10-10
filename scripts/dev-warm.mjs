import { spawn } from "node:child_process";
import http from "node:http";

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const ROUTES_TO_WARM = ["/chat", "/dashboard", "/quiz", "/settings"];

console.log("[dev:warm] Starting Next.js development server...");
const nextDev = spawn("npx", ["next", "dev", "-p", String(PORT)], {
  stdio: "inherit",
  shell: true,
});

async function waitForServer(retries = 40, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(BASE_URL, (res) => {
          resolve(res.statusCode);
        });
        req.on("error", reject);
        req.setTimeout(1500, () => {
          req.destroy();
          reject(new Error("Timeout"));
        });
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

async function warmRoute(path) {
  const url = `${BASE_URL}${path}`;
  const start = Date.now();
  try {
    await fetch(url, { headers: { "User-Agent": "LearnAI-DevWarm/1.0" } });
    const dur = Date.now() - start;
    console.log(`[dev:warm] Successfully warmed ${path} (${dur}ms)`);
  } catch (err) {
    console.warn(`[dev:warm] Route ${path} warm attempt finished with: ${err.message}`);
  }
}

async function runWarmup() {
  const isUp = await waitForServer();
  if (!isUp) {
    console.error("[dev:warm] Dev server did not start in time. Warmup aborted.");
    return;
  }

  console.log(`[dev:warm] Dev server detected at ${BASE_URL}. Warming routes...`);
  for (const route of ROUTES_TO_WARM) {
    await warmRoute(route);
  }
  console.log("[dev:warm] All target routes pre-warmed and compiled!");
}

runWarmup();

process.on("SIGINT", () => {
  nextDev.kill("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  nextDev.kill("SIGTERM");
  process.exit(0);
});
