import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const root = resolve(import.meta.dirname, "..");
const workdir = mkdtempSync(join(tmpdir(), "mayaana-clinical-"));
const env = { ...process.env, SUPABASE_ACCESS_TOKEN: "", SUPABASE_DB_PASSWORD: "", SUPABASE_DB_URL: "", DATABASE_URL: "" };
const cli = process.platform === "win32" ? "supabase.exe" : "supabase";
async function run(command, args, childEnv = env, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: childEnv, stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit" });
    let output = "";
    if (capture) child.stdout.on("data", chunk => { output += chunk; });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve(output) : reject(new Error(`${command} ${args[0]} failed (${code})`)));
  });
}
// The previous stack's containers can take a while to release their ports.
async function portFree(port) {
  for (let attempt = 1; ; attempt++) {
    const free = await new Promise(resolve => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
    });
    if (free) return;
    if (attempt === 24) throw new Error(`Test port ${port} occupied; refusing to attach to another stack.`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
// A first start pulls images and can take several minutes, so it has no
// timeout here: a timed-out start kept running and later blocked cleanup.
async function startStack() {
  await supabase(["start"], true);
}
const supabase = (args, capture = false) => run(cli, [...args, "--workdir", workdir], env, capture);
async function waitForClinicalSchema(testEnv) {
  // migration up commits before PostgREST processes its asynchronous schema
  // notification. Wait on actual column visibility, not a guessed fixed sleep.
  await supabase(["db","query","--local","notify pgrst, 'reload schema'"]);
  const client=createClient(testEnv.NEXT_PUBLIC_SUPABASE_URL,testEnv.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const deadline=Date.now()+30000;
  while (true) {
    const results=await Promise.all([
      client.from("visits").select("id,queue_entry_id,completed_at").limit(0),
      client.from("visit_measurements").select("measurements").limit(0),
    ]);
    const error=results.find(result=>result.error)?.error;
    if (!error) return;
    if (!['PGRST200','PGRST202','PGRST204','PGRST205'].includes(error.code) || Date.now()>=deadline) throw error;
    await delay(200);
  }
}
let started = false;
try {
  cpSync(join(root, "supabase"), join(workdir, "supabase"), { recursive: true, filter: source => !source.includes(`${process.platform === "win32" ? "\\" : "/"}.temp`) });
  const config = join(workdir, "supabase", "config.toml");
  writeFileSync(config, readFileSync(config, "utf8").replace(/project_id = "[^"]+"/, `project_id = "clinical-${randomUUID().slice(0, 18)}"`));
  for (const port of [55430, 55431, 55432]) {
    await portFree(port);
  }
  started = true;
  await startStack();
  const status = JSON.parse(await supabase(["status", "--output", "json"], true));
  if (status.API_URL !== "http://127.0.0.1:55431" || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error("Non-local/incomplete test configuration refused");
  const testEnv = { ...env, CLINICAL_TEST_LOCAL: "1", CLINICAL_TEST_WORKDIR: workdir, NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY, SUPABASE_SECRET_KEY: status.SERVICE_ROLE_KEY };
  await supabase(["db", "reset", "--local"]);
  if (process.argv.includes("--browser")) {
    await run(process.execPath,["node_modules/next/dist/bin/next","build"],testEnv);
    await run(process.execPath,["scripts/verify-browser-secrets.mjs"],testEnv);
    await run(process.execPath,["node_modules/@playwright/test/cli.js","test","--config=playwright.clinical.config.ts"],testEnv);
  } else {
    await supabase(["db","query","--local","--file",join(root,"tests/clinical/security-contract.sql")]);
    // Clean replay, then replay the live-schema upgrade path with synthetic rows.
    await run(process.execPath, ["--test", "tests/clinical/database.test.mjs"], testEnv);
    await supabase(["db", "reset", "--local", "--version", "20261019092326"]);
    await run(process.execPath, ["tests/clinical/upgrade-seed.mjs"], testEnv);
    await supabase(["migration", "up", "--local"]);
    await waitForClinicalSchema(testEnv);
    await run(process.execPath,["tests/clinical/upgrade-verify.mjs"],testEnv);
    await supabase(["db","query","--local","--file",join(root,"tests/clinical/security-contract.sql")]);
    await run(process.execPath, ["--test", "tests/clinical/database.test.mjs"], testEnv);
    // PR #36's deployed Slice 1 is a second upgrade baseline, not a schema to
    // omit or rewrite. Seed through its original RPCs and verify exact IDs,
    // typed measurements, request identities and retry behavior after upgrade.
    await supabase(["db", "reset", "--local", "--version", "20261023160531"]);
    await run(process.execPath,["tests/clinical/slice1-upgrade.mjs","seed"],testEnv);
    await supabase(["migration","up","--local"]);
    await waitForClinicalSchema(testEnv);
    await run(process.execPath,["tests/clinical/slice1-upgrade.mjs","verify"],testEnv);
    await supabase(["db","query","--local","--file",join(root,"tests/clinical/security-contract.sql")]);
    await run(process.execPath,["--test","tests/clinical/database.test.mjs"],testEnv);
    // Existing parallel consultations must block this migration without any
    // automatic clinical repair. Verify rollback, explicit resolution, retry.
    await supabase(["db", "reset", "--local", "--version", "20261023162459"]);
    await run(process.execPath, ["tests/clinical/single-active-upgrade.mjs", "seed"], testEnv);
    let blocked = false;
    try { await supabase(["migration", "up", "--local"]); }
    catch { blocked = true; }
    if (!blocked) throw new Error("Conflicting consultations did not block migration");
    await run(process.execPath, ["tests/clinical/single-active-upgrade.mjs", "blocked"], testEnv);
    await supabase(["migration", "up", "--local"]);
    await waitForClinicalSchema(testEnv);
    await run(process.execPath, ["tests/clinical/single-active-upgrade.mjs", "verify"], testEnv);
    await supabase(["db","query","--local","--file",join(root,"tests/clinical/security-contract.sql")]);
    await supabase(["db", "lint", "--local", "--level", "warning", "--fail-on", "warning"]);
    await supabase(["db", "advisors", "--local", "--fail-on", "warn"]);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) {
    try { await supabase(["stop", "--no-backup"], true); }
    catch { console.error("Test-owned clinical stack cleanup failed."); process.exitCode = 1; }
  }
  rmSync(workdir, { recursive: true, force: true });
}
