import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

if (process.env.CLINICAL_TEST_LOCAL !== "1" || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:55431") throw new Error("Isolated local runner required");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, options);
const anonymous = createClient(url, anonKey, options);
const staff = {};
const clinics = [];
const patientId = randomUUID();
let queue;
let visitId;
const measurements = { weight: 80, fat: 20, muscle: 30, visceral: 7, bmr: 1600, waist: 85, arm: 30, thigh: 50, hip: 100 };
const days = [{ id: randomUUID(), meals: [{ id: randomUUID(), type: "فطور", description: "Synthetic meal" }] }];
const rpc = async (client, name, args) => {
  const result = await client.rpc(name, args);
  assert.ifError(result.error);
  return result.data;
};
const denied = async promise => { const result = await promise; assert.ok(result.error, "Operation must fail"); return result.error; };
function fault(file) {
  assert.ok(process.env.CLINICAL_TEST_WORKDIR);
  const result=spawnSync(process.platform==="win32"?"supabase.exe":"supabase",["db","query","--local","--file",resolve("tests/clinical",file),"--workdir",process.env.CLINICAL_TEST_WORKDIR],{env:process.env,encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);
}
const create = (id = patientId, clinic = clinics[0]) => ({ p_id: id, p_clinic: clinic, p_name: "Synthetic patient", p_phone: "+12025550101", p_height: 170, p_gender: "female", p_birth_year: 1990, p_goal: "نقص وزن" });
const tableNames = ["patients", "daily_queue", "visits", "visit_measurements", "visit_private_notes", "diet_plans", "appointments"];

// Tests share staff fixtures, not active consultations. Release slots through
// the actual completion transaction rather than bypassing lifecycle guards.
afterEach(async () => {
  for (const [index, doctor] of [staff.doctor, staff.otherDoctor].entries()) {
    if (!doctor) continue;
    const rows = await doctor.from("daily_queue").select("id,revision").eq("clinic_id", clinics[index]).eq("status", "with_doctor");
    assert.ifError(rows.error);
    for (const row of rows.data) await complete(doctor, row);
  }
});

const complete = (doctor, entry) => rpc(doctor, "clinical_finish", {
  p_queue: entry.id, p_revision: entry.revision, p_request: randomUUID(),
  p_notes: "Synthetic completion", p_days: days, p_appointment: null,
});

async function readyVisit(client = staff.secretary, clinic = clinics[0]) {
  const patient = await rpc(client, "clinical_create_patient", create(randomUUID(), clinic));
  const entry = await rpc(client, "clinical_enqueue", { p_clinic: clinic, p_patient: patient, p_kind: "full_exam" });
  return rpc(client, "clinical_save_measurements", { p_queue: entry.id, p_revision: entry.revision, p_values: measurements });
}
const handoffArgs = entry => ({ p_queue: entry.id, p_revision: entry.revision, p_request: randomUUID() });

// Each doctor scenario establishes its own legal transition sequence. A failed
// handoff-injection test must not masquerade as a doctor/finish RPC failure.
async function doctorVisit() {
  const patient = await rpc(staff.secretary,"clinical_create_patient",create(randomUUID()));
  let queue = await rpc(staff.secretary,"clinical_enqueue",{p_clinic:clinics[0],p_patient:patient,p_kind:"full_exam"});
  queue = await rpc(staff.secretary,"clinical_save_measurements",{p_queue:queue.id,p_revision:queue.revision,p_values:measurements});
  queue = await rpc(staff.secretary,"clinical_handoff",{p_queue:queue.id,p_revision:queue.revision,p_request:randomUUID()});
  assert.equal(queue.status,"with_doctor");
  const visit = await staff.doctor.from("visits").select("id,started_at").eq("queue_id",queue.id).single();
  assert.ifError(visit.error); assert.ok(visit.data.started_at);
  return {queue,visitId:visit.data.id};
}

before(async () => {
  for (const name of ["doctor", "otherDoctor", "secretary", "inactive", "firstUse"]) {
    const email = `${randomUUID()}@clinical.example.test`;
    const password = randomUUID();
    const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(user.error);
    if (name.includes("Doctor") || name === "doctor") {
      const clinic = await admin.from("clinics").insert({ name: "Synthetic isolated clinic", doctor_user_id: user.data.user.id }).select("id").single();
      assert.ifError(clinic.error); clinics.push(clinic.data.id);
    }
    assert.ifError((await admin.from("clinic_staff").insert({ user_id: user.data.user.id, clinic_id: name === "otherDoctor" ? clinics[1] : clinics[0], role: name === "doctor" || name === "otherDoctor" ? "doctor" : "secretary", login_email: email, display_name: name, active: name !== "inactive", must_change_password: name === "firstUse" })).error);
    const client = createClient(url, anonKey, options);
    assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
    staff[name] = client;
  }
});

test("anonymous has no clinical access; inactive and first-use staff see no clinical rows", async () => {
  for (const table of tableNames) await denied(anonymous.from(table).select("*"));
  for (const name of ["inactive", "firstUse"]) await denied(staff[name].rpc("clinical_create_patient", create(randomUUID())));
});

test("patient creation is UUID-idempotent and contacts are not identities", async () => {
  const args = create();
  assert.equal(await rpc(staff.secretary, "clinical_create_patient", args), patientId);
  assert.equal(await rpc(staff.secretary, "clinical_create_patient", args), patientId);
  await denied(staff.secretary.rpc("clinical_create_patient", { ...args, p_name: "Changed retry" }));
  await rpc(staff.secretary, "clinical_create_patient", create(randomUUID()));
  await denied(staff.secretary.rpc("clinical_create_patient", create(randomUUID(), clinics[1])));
});

test("cross-clinic reads/writes and direct mutation bypasses are denied", async () => {
  for (const table of tableNames) {
    const result = await staff.otherDoctor.from(table).select("*");
    assert.ifError(result.error); assert.deepEqual(result.data, []);
    for (const name of ["inactive", "firstUse"]) {
      const rows = await staff[name].from(table).select("*"); assert.ifError(rows.error); assert.deepEqual(rows.data, []);
    }
  }
  await denied(staff.secretary.from("patients").update({ full_name: "Forged" }).eq("id", patientId));
  await denied(staff.secretary.from("patients").delete().eq("id", patientId));
  await denied(staff.otherDoctor.rpc("clinical_enqueue", { p_clinic: clinics[1], p_patient: patientId, p_kind: "full_exam" }));
  await denied(admin.from("daily_queue").insert({ clinic_id: clinics[1], patient_id: patientId, visit_type: "full_exam" }));
});

test("patient corrections preserve identity/metadata and reject stale or cross-clinic writes",async()=>{
  const original=await staff.doctor.from("patients").select("created_at,created_by,revision").eq("id",patientId).single();assert.ifError(original.error);
  const input={p_id:patientId,p_revision:original.data.revision,p_name:"Corrected synthetic patient",p_phone:"+12025550101",p_height:170,p_gender:"female",p_birth_year:1990,p_goal:"نقص وزن"};
  const next=await rpc(staff.secretary,"clinical_update_patient",input);assert.equal(next,original.data.revision+1);
  const stale=await denied(staff.secretary.rpc("clinical_update_patient",input));assert.equal(stale.code,"PT409");
  await denied(staff.otherDoctor.rpc("clinical_update_patient",{...input,p_revision:next}));
  const corrected=await staff.doctor.from("patients").select("id,full_name,created_at,created_by,revision").eq("id",patientId).single();assert.ifError(corrected.error);assert.equal(corrected.data.id,patientId);assert.equal(corrected.data.full_name,input.p_name);assert.equal(corrected.data.created_at,original.data.created_at);assert.equal(corrected.data.created_by,original.data.created_by);
});

test("concurrent duplicate enqueue creates exactly one queue entry and visit", async () => {
  const firstFollowUp=await denied(staff.secretary.rpc("clinical_enqueue",{p_clinic:clinics[0],p_patient:patientId,p_kind:"follow_up"}));
  assert.equal(firstFollowUp.code,"23514", "A new patient must begin with a full exam");
  const args = { p_clinic: clinics[0], p_patient: patientId, p_kind: "full_exam" };
  const [first, retry] = await Promise.all([rpc(staff.secretary, "clinical_enqueue", args), rpc(staff.secretary, "clinical_enqueue", args)]);
  assert.equal(first.id, retry.id); queue = first;
  const visits = await staff.doctor.from("visits").select("*").eq("queue_entry_id", queue.id);
  assert.ifError(visits.error); assert.equal(visits.data.length, 1); visitId = visits.data[0].id;
  await denied(admin.from("visits").insert({ clinic_id: clinics[1], patient_id: patientId, queue_id: queue.id, created_by: visits.data[0].created_by, updated_by: visits.data[0].created_by }));
  const duplicate=await denied(admin.from("visits").insert({clinic_id:clinics[0],patient_id:patientId,queue_id:queue.id,created_by:visits.data[0].created_by,updated_by:visits.data[0].created_by}));assert.equal(duplicate.code,"23505");
  await denied(staff.secretary.rpc("clinical_enqueue", { ...args, p_kind: "follow_up" }));
});

test("failed enqueue cannot leave an orphan visit", async () => {
  const before = await admin.from("visits").select("id", { count: "exact", head: true });
  await denied(staff.secretary.rpc("clinical_enqueue", { p_clinic: clinics[0], p_patient: randomUUID(), p_kind: "full_exam" }));
  const after = await admin.from("visits").select("id", { count: "exact", head: true }); assert.equal(before.count, after.count);
});

test("handoff without measurements and invalid measurement saves roll back completely", async () => {
  await denied(staff.secretary.rpc("clinical_handoff", { p_queue: queue.id, p_revision: queue.revision, p_request: randomUUID() }));
  for (const values of [{ weight: 80 }, { ...measurements, weight: -1 }, { ...measurements, secret: 1 }, { ...measurements, fat: "20" }]) {
    await denied(staff.secretary.rpc("clinical_save_measurements", { p_queue: queue.id, p_revision: queue.revision, p_values: values }));
  }
  const unchanged = await staff.secretary.from("daily_queue").select("*").eq("id", queue.id).single();
  assert.equal(unchanged.data.status, "waiting"); assert.equal(unchanged.data.revision, queue.revision);
  const visits = await staff.doctor.from("visits").select("started_at").eq("id", visitId).single(); assert.equal(visits.data.started_at, null);
});

test("measurement persistence, stale rejection, retry-safe handoff and no post-handoff intake mutation", async () => {
  const oldRevision = queue.revision;
  queue = await rpc(staff.secretary, "clinical_save_measurements", { p_queue: queue.id, p_revision: queue.revision, p_values: measurements });
  assert.equal(queue.status, "ready");
  const stale = await denied(staff.secretary.rpc("clinical_save_measurements", { p_queue: queue.id, p_revision: oldRevision, p_values: { ...measurements, weight: 90 } })); assert.equal(stale.code, "PT409");
  const handoff = { p_queue: queue.id, p_revision: queue.revision, p_request: randomUUID() };
  fault("fault-handoff.sql");
  try {
    const injected = await denied(staff.secretary.rpc("clinical_handoff",handoff));
    assert.equal(injected.code,"22023"); assert.equal(injected.message,"Synthetic handoff write failure");
    const unchanged=await staff.doctor.from("visits").select("started_at,revision").eq("id",visitId).single();assert.ifError(unchanged.error);assert.equal(unchanged.data.started_at,null);
    const waiting=await staff.secretary.from("daily_queue").select("status,revision").eq("id",queue.id).single();assert.ifError(waiting.error);assert.equal(waiting.data.status,"ready");assert.equal(waiting.data.revision,queue.revision);
  } finally { fault("fault-cleanup.sql"); }
  const [first, retry] = await Promise.all([rpc(staff.secretary, "clinical_handoff", handoff), rpc(staff.secretary, "clinical_handoff", handoff)]);
  assert.deepEqual(first, retry); queue = first; assert.equal(queue.status, "with_doctor");
  await denied(staff.secretary.rpc("clinical_save_measurements", { p_queue: queue.id, p_revision: queue.revision, p_values: measurements }));
  const persisted = await staff.doctor.from("visit_measurements").select("measurements").eq("visit_id", visitId).single(); assert.deepEqual(persisted.data.measurements, measurements);
});

test("doctor-only drafts and private notes isolation, including direct writes", async () => {
  let {queue,visitId} = await doctorVisit();
  const args = { p_queue: queue.id, p_revision: queue.revision, p_notes: "Synthetic private note", p_days: days, p_appointment: null };
  await denied(staff.secretary.rpc("clinical_save_doctor_draft", args));
  queue = await rpc(staff.doctor, "clinical_save_doctor_draft", args);
  const stale=await denied(staff.doctor.rpc("clinical_save_doctor_draft",{...args,p_notes:"Stale draft"})); assert.equal(stale.code,"PT409");
  const staleFinish=await denied(staff.doctor.rpc("clinical_finish",{...args,p_request:randomUUID()})); assert.equal(staleFinish.code,"PT409");
  for (const table of ["visit_private_notes", "diet_plans"]) {
    const rows = await staff.secretary.from(table).select("*"); assert.ifError(rows.error); assert.deepEqual(rows.data, []);
    await denied(staff.secretary.from(table).insert({ visit_id: visitId, clinic_id: clinics[0] }));
  }
  assert.ok(!JSON.stringify(queue).includes("Synthetic private note"));
  const notes = await staff.doctor.from("visit_private_notes").select("notes").eq("visit_id", visitId).single(); assert.equal(notes.data.notes, args.p_notes);
});

test("failed completion leaves no partial notes, plan, appointment or completed state", async () => {
  let {queue,visitId} = await doctorVisit();
  queue=await rpc(staff.doctor,"clinical_save_doctor_draft",{p_queue:queue.id,p_revision:queue.revision,p_notes:"Synthetic private note",p_days:days,p_appointment:null});
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0,10);
  const args = { p_queue: queue.id, p_revision: queue.revision, p_request: randomUUID(), p_notes: "Must roll back", p_days: [], p_appointment: tomorrow };
  await denied(staff.doctor.rpc("clinical_finish", args));
  await denied(staff.doctor.rpc("clinical_finish", { ...args, p_days: days, p_appointment: "2000-01-01" }));
  await denied(staff.secretary.rpc("clinical_finish", { ...args, p_days: days }));
  fault("fault-completion.sql");
  try {
    const injected=await denied(staff.doctor.rpc("clinical_finish",{...args,p_days:[{id:randomUUID(),meals:[{id:randomUUID(),type:"فطور",description:"This partial diet must roll back"}]}]}));
    assert.equal(injected.code,"22023"); assert.equal(injected.message,"Synthetic appointment write failure");
  }
  finally { fault("fault-cleanup.sql"); }
  const notes = await staff.doctor.from("visit_private_notes").select("notes").eq("visit_id", visitId).single(); assert.equal(notes.data.notes, "Synthetic private note");
  const diet=await staff.doctor.from("diet_plans").select("days").eq("visit_id",visitId).single();assert.ifError(diet.error);assert.deepEqual(diet.data.days,days);
  const appointments = await staff.doctor.from("appointments").select("*").eq("originating_visit_id", visitId); assert.deepEqual(appointments.data, []);
  const visit = await staff.doctor.from("visits").select("completed_at").eq("id", visitId).single(); assert.equal(visit.data.completed_at, null);
  const row = await staff.doctor.from("daily_queue").select("*").eq("id", queue.id).single(); assert.equal(row.data.status, "with_doctor"); assert.equal(row.data.revision, queue.revision);
});

test("finish is atomic, retry-safe, visible across sessions and immutable", async () => {
  let {queue,visitId} = await doctorVisit();
  const args = { p_queue: queue.id, p_revision: queue.revision, p_request: randomUUID(), p_notes: "Final private note", p_days: days, p_appointment: new Date(Date.now()+86400000).toISOString().slice(0,10) };
  const [first, retry] = await Promise.all([rpc(staff.doctor, "clinical_finish", args), rpc(staff.doctor, "clinical_finish", args)]);
  assert.deepEqual(first,retry); queue = first; assert.equal(queue.status, "completed");
  const secretary = await staff.secretary.from("daily_queue").select("status").eq("id", queue.id).single(); assert.equal(secretary.data.status,"completed");
  await denied(staff.doctor.rpc("clinical_finish", { ...args, p_request: randomUUID() }));
  await denied(staff.doctor.rpc("clinical_save_doctor_draft", { p_queue: queue.id, p_revision: queue.revision, p_notes: "Tampering", p_days: days, p_appointment: null }));
  await denied(staff.doctor.from("daily_queue").update({ status: "waiting" }).eq("id",queue.id));
  await denied(admin.from("visit_private_notes").update({ notes: "Tampering" }).eq("visit_id",visitId));
  const visits = await staff.doctor.from("visits").select("completed_at").eq("id",visitId).single(); assert.ok(visits.data.completed_at);
  const notes = await staff.secretary.from("visit_private_notes").select("*"); assert.deepEqual(notes.data,[]);
  const appointment = await staff.secretary.from("appointments").select("appointment_date").eq("originating_visit_id",visitId).single(); assert.equal(appointment.data.appointment_date,args.p_appointment);
});

test("one active patient per clinic: sequential conflict, legacy RPC, completion and delayed retries", async () => {
  const first = await readyVisit(), second = await readyVisit();
  const args = handoffArgs(first), blockedArgs = handoffArgs(second);
  const active = await rpc(staff.secretary, "clinical_handoff", args);
  const blocked = await denied(staff.secretary.rpc("clinical_handoff", blockedArgs));
  assert.equal(blocked.code, "PT409"); assert.equal(blocked.details, "clinic_occupied");
  const legacy = await denied(staff.secretary.rpc("clinical_handoff", { p_entry: second.id, p_revision: second.revision }));
  assert.equal(legacy.code, "PT409"); assert.equal(legacy.details, "clinic_occupied");
  assert.deepEqual(await rpc(staff.secretary, "clinical_handoff", args), active);
  const unchanged = await staff.secretary.from("daily_queue").select("*").eq("id", second.id).single();
  assert.ifError(unchanged.error); assert.deepEqual(unchanged.data, second);
  const visit = await staff.doctor.from("visits").select("started_at,revision").eq("queue_id", second.id).single();
  assert.ifError(visit.error); assert.equal(visit.data.started_at, null);
  const finished = await complete(staff.doctor, active);
  const next = await rpc(staff.secretary, "clinical_handoff", blockedArgs);
  assert.equal(next.status, "with_doctor");
  assert.deepEqual(await rpc(staff.secretary, "clinical_handoff", args), finished, "A delayed acknowledged request must not reopen the completed visit");
});

test("simultaneous different-patient handoffs commit exactly one consultation and roll back the loser", async () => {
  const entries = await Promise.all([readyVisit(), readyVisit()]);
  const requests = entries.map(handoffArgs);
  const results = await Promise.all(requests.map(args => staff.secretary.rpc("clinical_handoff", args)));
  assert.equal(results.filter(result => !result.error).length, 1);
  const loser = results.findIndex(result => result.error);
  assert.equal(results[loser].error.code, "PT409"); assert.equal(results[loser].error.details, "clinic_occupied");
  const winner = results.find(result => !result.error).data;
  const rows = await staff.secretary.from("daily_queue").select("id,status,revision").eq("clinic_id", clinics[0]).eq("status", "with_doctor");
  assert.ifError(rows.error); assert.equal(rows.data.length, 1); assert.equal(rows.data[0].id, winner.id);
  const unchanged = await staff.secretary.from("daily_queue").select("*").eq("id", entries[loser].id).single();
  assert.ifError(unchanged.error); assert.deepEqual(unchanged.data, entries[loser]);
  const visit = await staff.doctor.from("visits").select("started_at").eq("queue_id", entries[loser].id).single();
  assert.ifError(visit.error); assert.equal(visit.data.started_at, null);
  await complete(staff.doctor, winner);
  assert.equal((await rpc(staff.secretary, "clinical_handoff", requests[loser])).status, "with_doctor");
});

test("clinic slots are independent, including simultaneous handoffs", async () => {
  const entries = await Promise.all([readyVisit(), readyVisit(staff.otherDoctor, clinics[1])]);
  const results = await Promise.all(entries.map((entry, index) => rpc(index ? staff.otherDoctor : staff.secretary, "clinical_handoff", handoffArgs(entry))));
  assert.ok(results.every(result => result.status === "with_doctor"));
  const hidden = await staff.otherDoctor.from("daily_queue").select("id").eq("id", entries[0].id);
  assert.ifError(hidden.error); assert.deepEqual(hidden.data, []);
});

test("the unique slot also rejects privileged direct inserts, regardless of service date", async () => {
  const first = await readyVisit();
  await rpc(staff.secretary, "clinical_handoff", handoffArgs(first));
  const patient = await rpc(staff.secretary, "clinical_create_patient", create(randomUUID()));
  const error = await denied(admin.from("daily_queue").insert({ clinic_id: clinics[0], patient_id: patient, visit_type: "full_exam", status: "with_doctor", queue_date: "2000-01-01" }));
  assert.equal(error.code, "23505"); assert.match(error.message, /daily_queue_one_with_doctor_per_clinic/);
});

test("an overnight active consultation still blocks handoff and can be completed only by its Doctor", async () => {
  const first = await readyVisit(), second = await readyVisit();
  const active = await rpc(staff.secretary, "clinical_handoff", handoffArgs(first));
  // Simulate midnight on this exact synthetic row, retaining all measurements
  // and timestamps. Do not alter the clock or any other fixture's records.
  const user = await staff.doctor.auth.getUser(); assert.ifError(user.error);
  const sql = `do $$ begin perform set_config('request.jwt.claim.sub','${user.data.user.id}',true); update public.daily_queue set queue_date=queue_date-1,revision=revision+1 where id='${active.id}'; end $$;`;
  const result = spawnSync(process.platform === "win32" ? "supabase.exe" : "supabase", ["db", "query", "--local", sql, "--workdir", process.env.CLINICAL_TEST_WORKDIR], { env: process.env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const overnight = await staff.doctor.from("daily_queue").select("*").eq("id", active.id).single(); assert.ifError(overnight.error);
  const conflict = await denied(staff.secretary.rpc("clinical_handoff", handoffArgs(second)));
  assert.equal(conflict.details, "clinic_occupied");
  await denied(staff.secretary.rpc("clinical_finish", { p_queue: active.id, p_revision: overnight.data.revision, p_request: randomUUID(), p_notes: "Not allowed", p_days: days, p_appointment: null }));
  assert.equal((await complete(staff.doctor, overnight.data)).status, "completed");
  assert.equal((await rpc(staff.secretary, "clinical_handoff", handoffArgs(second))).status, "with_doctor");
});
