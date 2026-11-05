import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";

// Always create our own unlinked stack. Never load .env.local or accept a hosted URL.
const root = resolve(import.meta.dirname, "..");
const workdir = mkdtempSync(join(tmpdir(), "mayaana-auth-"));
const env = { ...process.env, SUPABASE_ACCESS_TOKEN: "", SUPABASE_DB_PASSWORD: "", SUPABASE_DB_URL: "", DATABASE_URL: "" };
const cli = process.platform === "win32" ? "supabase.exe" : "supabase";
async function run(command, args, childEnv = env, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: childEnv, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
    let output = "";
    if (capture) child.stdout.on("data", chunk => { output += chunk; });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve(output) : reject(new Error(`${command} ${args[0]} failed (${code}); Docker and Supabase CLI are required.`)));
  });
}
const supabase = (args, capture = false) => run(cli, [...args, "--workdir", workdir], env, capture);
// The previous stack's containers can take a while to release their ports.
async function portFree(port) {
  for (let attempt = 1; ; attempt++) {
    const free = await new Promise(resolve => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
    });
    if (free) return;
    if (attempt === 24) throw new Error(`Test port ${port} is occupied; refusing to attach to another stack.`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
// A silent image pull can hang until the job times out, so fail early and retry once.
async function startStack() {
  try {
    await withTimeout(supabase(["start"], true), 480000);
  } catch {
    await supabase(["stop", "--no-backup"], true).catch(() => undefined);
    await withTimeout(supabase(["start"], true), 480000);
  }
}
function withTimeout(promise, ms) {
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Supabase start timed out.")), ms);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}
let started = false;
try {
  cpSync(join(root, "supabase"), join(workdir, "supabase"), { recursive: true, filter: source => !source.includes(`${process.platform === "win32" ? "\\" : "/"}.temp`) });
  const config = join(workdir, "supabase", "config.toml");
  writeFileSync(config, readFileSync(config, "utf8").replace(/^project_id = ".*"/m, `project_id = "auth-${randomUUID()}"`));
  for (const port of [55430, 55431, 55432, 55439, 3102]) {
    await portFree(port);
  }
  started = true;
  await startStack(); // Do not print local keys.
  await supabase(["db", "reset", "--local"]);
  const status = JSON.parse(await supabase(["status", "--output", "json"], true));
  const url = new URL(status.API_URL);
  if (url.origin !== "http://127.0.0.1:55431" || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error("Refusing non-local/incomplete test configuration");
  const testEnv = { ...env,
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55439",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
    SUPABASE_SECRET_KEY: status.SERVICE_ROLE_KEY,
    AUTH_TEST_LOCAL: "1",
    AUTH_TEST_PASSWORD: randomUUID() + "aA1!",
  };
  await run(process.execPath, ["node_modules/next/dist/bin/next", "build"], testEnv);
  await run(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config=playwright.auth.config.ts", ...process.argv.slice(2)], testEnv);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) {
    try { await supabase(["stop", "--no-backup"], true); }
    catch { console.error("Test-owned stack cleanup failed."); process.exitCode = 1; }
  }
  rmSync(workdir, { recursive: true, force: true });
}
