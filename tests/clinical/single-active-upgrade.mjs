import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

if (process.env.CLINICAL_TEST_LOCAL !== "1" || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:55431" || !process.env.CLINICAL_TEST_WORKDIR)
  throw new Error("Disposable local clinical runner required");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, options);
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const file = join(process.env.CLINICAL_TEST_WORKDIR, "synthetic-single-active.json");
const rpc = async (name, args) => { const result = await client.rpc(name, args); assert.ifError(result.error); return result.data; };
const days = [{ id: randomUUID(), meals: [{ id: randomUUID(), type: "فطور", description: "Synthetic upgrade meal" }] }];
const finish = entry => rpc("clinical_finish", { p_queue: entry.id, p_revision: entry.revision, p_request: randomUUID(), p_notes: "Synthetic reconciliation", p_days: days, p_appointment: null });
const mode = process.argv[2];
if (mode === "seed") {
  const email = `${randomUUID()}@single-active.example.test`, password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error);
  const clinic = await admin.from("clinics").insert({ name: "Synthetic conflicting consultations", doctor_user_id: created.data.user.id }).select("id").single(); assert.ifError(clinic.error);
  assert.ifError((await admin.from("clinic_staff").insert({ user_id: created.data.user.id, clinic_id: clinic.data.id, role: "doctor", login_email: email, display_name: "Synthetic", active: true, must_change_password: false })).error);
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  const entries = [], requests = [];
  for (let i = 0; i < 2; i++) {
    const id = randomUUID();
    await rpc("clinical_create_patient", { p_id: id, p_clinic: clinic.data.id, p_name: "Synthetic conflicting visit", p_phone: "+12025550126", p_height: 170, p_gender: "female", p_birth_year: 1990, p_goal: "نقص وزن" });
    let entry = await rpc("clinical_enqueue", { p_clinic: clinic.data.id, p_patient: id, p_kind: "full_exam" });
    entry = await rpc("clinical_save_measurements", { p_queue: entry.id, p_revision: entry.revision, p_values: { weight: 80, fat: 20, muscle: 30, visceral: 7, bmr: 1600, waist: 85, arm: 30, thigh: 50, hip: 100 } });
    const request = { p_queue: entry.id, p_revision: entry.revision, p_request: randomUUID() };
    requests.push(request); entries.push(await rpc("clinical_handoff", request));
  }
  writeFileSync(file, JSON.stringify({ email, password, clinic: clinic.data.id, entries, requests }));
} else {
  const saved = JSON.parse(readFileSync(file, "utf8"));
  assert.ifError((await client.auth.signInWithPassword({ email: saved.email, password: saved.password })).error);
  if (mode === "blocked") {
    const rows = await client.from("daily_queue").select("*").eq("clinic_id", saved.clinic); assert.ifError(rows.error);
    assert.equal(rows.data.length, 2);
    for (const entry of saved.entries) assert.deepEqual(rows.data.find(row => row.id === entry.id), entry, "Failed migration must not rewrite visits or queue metadata");
    // Explicit synthetic operator resolution through the approved Doctor RPC,
    // not a migration repair and not a direct status rewrite.
    saved.entries[1] = await finish(saved.entries[1]);
    writeFileSync(file, JSON.stringify(saved));
  } else if (mode === "verify") {
    for (const [index, request] of saved.requests.entries()) assert.deepEqual(await rpc("clinical_handoff", request), saved.entries[index]);
    const active = await client.from("daily_queue").select("id").eq("clinic_id", saved.clinic).eq("status", "with_doctor"); assert.ifError(active.error); assert.equal(active.data.length, 1);
    assert.equal((await finish(saved.entries[0])).status, "completed");
  } else throw new Error("Unknown upgrade mode");
}
