import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

// Never load .env.local, link a project, accept a remote URL, or use db push.
const root = resolve(import.meta.dirname, "..");
const tempBase = process.platform === "win32" ? join(process.env.LOCALAPPDATA, "Temp", "opencode") : tmpdir();
const workdir = mkdtempSync(join(tempBase, "mayanaa-persistence-"));
const env = { ...process.env, SUPABASE_ACCESS_TOKEN: "", SUPABASE_DB_PASSWORD: "", DATABASE_URL: "", SUPABASE_DB_URL: "" };
const cli = process.platform === "win32" ? "supabase.exe" : "supabase";
function supabase(args, capture = false) {
  const result = spawnSync(cli, [...args, "--workdir", workdir], { cwd: root, env, encoding: "utf8", stdio: capture ? "pipe" : "inherit", maxBuffer: 64 * 1024 * 1024, timeout: 600000 });
  if (result.error || result.status !== 0) throw new Error(`Local Supabase ${args[0]} failed. Docker and Supabase CLI 2.81.3 are required.`);
  return result.stdout;
}
function node(args, childEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: childEnv, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Validation process failed (${code})`)));
  });
}
let started = false;
try {
  cpSync(join(root, "supabase"), join(workdir, "supabase"), { recursive: true, filter: source => !source.includes(`${process.platform === "win32" ? "\\" : "/"}.temp`) });
  const config = join(workdir, "supabase", "config.toml");
  writeFileSync(config, readFileSync(config, "utf8").replace('project_id = "mayanaa-slice1-tests"', `project_id = "slice1-${randomUUID().replaceAll("-", "").slice(0, 16)}"`));
  // Fail before attaching to another test stack. These are dedicated test ports.
  const { createServer } = await import("node:net");
  for (const port of [55430, 55431, 55432, 3101]) {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", () => reject(new Error(`Test port ${port} is already in use`)));
      server.listen(port, "127.0.0.1", () => server.close(resolve));
    });
  }
  started = true;
  // CLI startup/status can print local privileged keys. Never stream them to CI.
  supabase(["start"], true);
  console.log("Disposable local Supabase started; replaying migrations.");
  supabase(["db", "reset", "--local"], true);
  console.log("Clean local migration replay passed.");
  const status = JSON.parse(supabase(["status", "--output", "json"], true));
  const url = new URL(status.API_URL);
  const publicKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
  const secretKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
  if (url.hostname !== "127.0.0.1" || url.port !== "55431" || !publicKey || !secretKey) throw new Error("Refusing non-local or incomplete test configuration");
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(`::add-mask::${publicKey}`);
    console.log(`::add-mask::${secretKey}`);
  }
  const testEnv = { ...env,
    NEXT_PUBLIC_SUPABASE_URL: url.origin,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
    SUPABASE_SECRET_KEY: secretKey,
    PERSISTENCE_TEST_LOCAL: "1",
  };
  await node(["node_modules/next/dist/bin/next", "build"], testEnv);
  await node(["node_modules/@playwright/test/cli.js", "test", "--config=playwright.persistence.config.ts"], testEnv);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) {
    try { supabase(["stop", "--no-backup"]); }
    catch { console.error("Local test stack cleanup failed; inspect the test-owned Docker resources."); process.exitCode = 1; }
  }
  rmSync(workdir, { recursive: true, force: true });
}
