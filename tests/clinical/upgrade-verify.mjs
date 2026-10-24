import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
if(process.env.CLINICAL_TEST_LOCAL!=="1"||process.env.NEXT_PUBLIC_SUPABASE_URL!=="http://127.0.0.1:55431")throw new Error("Isolated runner required");
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const patient=await admin.from("patients").select("id,full_name,phone,height_cm,revision").eq("full_name","Synthetic historical patient").single();assert.ifError(patient.error);
assert.equal(patient.data.phone,"+12025550199");assert.equal(patient.data.height_cm,null);assert.equal(patient.data.revision,0);
const queue=await admin.from("daily_queue").select("id,status,revision").eq("patient_id",patient.data.id).single();assert.ifError(queue.error);assert.equal(queue.data.status,"waiting");assert.equal(queue.data.revision,0);
const visits=await admin.from("visits").select("id").eq("queue_entry_id",queue.data.id);assert.ifError(visits.error);assert.deepEqual(visits.data,[]);
console.log("Historical synthetic patient/queue preserved exactly; no invented clinical backfill.");
