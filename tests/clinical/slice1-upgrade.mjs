import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

if (process.env.CLINICAL_TEST_LOCAL !== "1" || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:55431" || !process.env.CLINICAL_TEST_WORKDIR) throw new Error("Isolated local runner required");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, options);
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const file = join(process.env.CLINICAL_TEST_WORKDIR,"synthetic-slice1.json");
async function rpc(name,args) { const r=await client.rpc(name,args); assert.ifError(r.error); return r.data; }
if (process.argv[2] === "seed") {
  const email=`${randomUUID()}@upgrade.example.test`, password=randomUUID();
  const user=await admin.auth.admin.createUser({email,password,email_confirm:true}); assert.ifError(user.error);
  const clinic=await admin.from("clinics").insert({name:"Synthetic Slice 1 upgrade",doctor_user_id:user.data.user.id}).select("id").single(); assert.ifError(clinic.error);
  assert.ifError((await admin.from("clinic_staff").insert({user_id:user.data.user.id,clinic_id:clinic.data.id,role:"secretary",login_email:email,display_name:"Synthetic",active:true,must_change_password:false})).error);
  assert.ifError((await client.auth.signInWithPassword({email,password})).error);
  const patient={p_id:randomUUID(),p_name:"Synthetic Slice 1 patient",p_phone:"+12025550111",p_height:"170",p_gender:"female",p_birth_year:"1990",p_goal:"نقص وزن"};
  await rpc("clinical_create_patient",patient);
  const entry=await rpc("clinical_enqueue",{p_patient:patient.p_id,p_kind:"full_exam"});
  const measurement={p_entry:entry,p_revision:0,p_request:randomUUID(),p_values:{weight:"80",fat:"20",muscle:"30",visceral:"7",bmr:"1600",waist:"85",arm:"30",thigh:"50",hip:"100"}};
  await rpc("clinical_save_measurements",measurement);
  await rpc("clinical_handoff",{p_entry:entry,p_revision:1});
  const rows={};
  for (const table of ["patients","daily_queue","visits","visit_measurements"]) {
    const r=await admin.from(table).select("*").eq("clinic_id",clinic.data.id); assert.ifError(r.error); assert.equal(r.data.length,1); rows[table]=r.data[0];
  }
  writeFileSync(file,JSON.stringify({email,password,patient,entry,measurement,rows}));
} else {
  const saved=JSON.parse(readFileSync(file,"utf8"));
  assert.ifError((await client.auth.signInWithPassword({email:saved.email,password:saved.password})).error);
  for (const [table,before] of Object.entries(saved.rows)) {
    const r=await admin.from(table).select(Object.keys(before).join(",")).eq("id",before.id).single();
    assert.ifError(r.error); assert.deepEqual(r.data,before,`${table} historical values must be unchanged`);
  }
  assert.equal(await rpc("clinical_create_patient",saved.patient),saved.patient.p_id);
  assert.equal(await rpc("clinical_enqueue",{p_patient:saved.patient.p_id,p_kind:"full_exam"}),saved.entry);
  assert.equal(await rpc("clinical_save_measurements",saved.measurement),saved.entry);
  const conflict=await client.rpc("clinical_save_measurements",{...saved.measurement,p_values:{...saved.measurement.p_values,weight:"81"}}); assert.equal(conflict.error?.code,"PT409");
  assert.equal(await rpc("clinical_handoff",{p_entry:saved.entry,p_revision:1}),saved.entry);
  const visit=await client.from("visits").select("id,queue_entry_id,started_at").eq("queue_id",saved.entry).single(); assert.ifError(visit.error);
  assert.equal(visit.data.id,saved.rows.visits.id); assert.equal(visit.data.queue_entry_id,saved.entry); assert.equal(visit.data.started_at,saved.rows.daily_queue.handed_off_at);
  const values=await client.from("visit_measurements").select("measurements").eq("id",saved.rows.visit_measurements.id).single(); assert.ifError(values.error);
  assert.deepEqual(values.data.measurements,Object.fromEntries(Object.entries(saved.measurement.p_values).map(([k,v])=>[k,Number(v)])));
  console.log("Slice 1 identities, metadata, typed measurements, handoff evidence and retry semantics preserved.");
}
