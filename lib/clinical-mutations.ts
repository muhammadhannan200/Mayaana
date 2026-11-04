import "server-only";
import type { VisitDraft, VisitMeasurement } from "./clinical-model";
import type { ClinicalResult, PatientInput } from "./clinical-types";
import {
  attempt,
  failure,
  invalid,
  mutate,
  normalizeClinicalNumber,
  session,
  validId,
} from "./clinical-core";

export async function createPatient(
  input: PatientInput
): Promise<ClinicalResult<null>> {
  return attempt(async () => {
    if (
      !input ||
      !validId(input.id) ||
      typeof input.name !== "string" ||
      input.name.trim().length < 2 ||
      input.name.length > 160 ||
      typeof input.phone !== "string" ||
      !/^\+?\d{6,15}$/.test(input.phone) ||
      typeof input.height !== "string" ||
      !Number.isFinite(Number(input.height)) ||
      Number(input.height) < 50 ||
      Number(input.height) > 250 ||
      !["male", "female"].includes(input.gender) ||
      typeof input.birthYear !== "string" ||
      (input.birthYear && !/^\d{4}$/.test(input.birthYear))
    )
      invalid();
    const { client, account } = await session();
    const { error } = await client.rpc("clinical_create_patient", {
      p_id: input.id,
      p_clinic: account.clinicId,
      p_name: input.name,
      p_phone: input.phone,
      p_height: Number(input.height),
      p_gender: input.gender,
      p_birth_year: input.birthYear ? Number(input.birthYear) : null,
      p_goal: input.goal,
    });
    if (error) throw error;
    return null;
  });
}
export async function enqueuePatient(
  patient: string,
  kind: string
): Promise<ClinicalResult<null>> {
  return attempt(async () => {
    if (!validId(patient) || !["full_exam", "follow_up"].includes(kind))
      invalid();
    const { client, account } = await session();
    const { error } = await client.rpc("clinical_enqueue", {
      p_clinic: account.clinicId,
      p_patient: patient,
      p_kind: kind,
    });
    if (error) throw error;
    return null;
  });
}
export async function saveMeasurements(
  entry: string,
  revision: number,
  values: VisitMeasurement,
  request: string
): Promise<ClinicalResult<null>> {
  if (
    !validId(entry) ||
    !validId(request) ||
    !Number.isInteger(revision) ||
    !values ||
    typeof values !== "object" ||
    Array.isArray(values)
  )
    return failure({ code: "22023" });
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(values)) {
    if (
      typeof value !== "string" ||
      !/^\d+(\.\d+)?$/.test(normalizeClinicalNumber(value))
    )
      return failure({ code: "22023" });
    normalized[key] = Number(normalizeClinicalNumber(value));
  }
  return mutate("clinical_save_measurements", {
    // Retain Slice 1's request/payload identity across a lost response. The
    // numeric foundation RPC remains available for non-retrying callers.
    p_entry: entry,
    p_revision: revision,
    p_request: request,
    p_values: Object.fromEntries(
      Object.entries(normalized).map(([key, value]) => [key, String(value)])
    ),
  });
}
export async function handoffToDoctor(
  entry: string,
  revision: number,
  request: string
): Promise<ClinicalResult<null>> {
  if (!validId(entry) || !validId(request) || !Number.isInteger(revision))
    return failure({ code: "22023" });
  return mutate("clinical_handoff", {
    p_queue: entry,
    p_revision: revision,
    p_request: request,
  });
}
export async function cancelHandoff(
  entry: string,
  revision: number
): Promise<ClinicalResult<null>> {
  if (!validId(entry) || !Number.isInteger(revision))
    return failure({ code: "22023" });
  return mutate("clinical_cancel_handoff", {
    p_queue: entry,
    p_revision: revision,
  });
}
export async function openVisit(entry: string): Promise<ClinicalResult<null>> {
  if (!validId(entry)) return failure({ code: "22023" });
  return mutate("clinical_open_visit", { p_queue: entry }, true);
}
function validDraft(entry: string, revision: number, draft: VisitDraft) {
  return (
    validId(entry) &&
    Number.isInteger(revision) &&
    draft &&
    typeof draft.notes === "string" &&
    draft.notes.length <= 20000 &&
    Array.isArray(draft.days) &&
    draft.days.length <= 60 &&
    typeof draft.appointment === "string" &&
    (!draft.appointment || /^\d{4}-\d{2}-\d{2}$/.test(draft.appointment))
  );
}
export async function saveDoctorDraft(
  entry: string,
  revision: number,
  draft: VisitDraft
): Promise<ClinicalResult<null>> {
  if (!validDraft(entry, revision, draft)) return failure({ code: "22023" });
  return mutate(
    "clinical_save_doctor_draft",
    {
      p_queue: entry,
      p_revision: revision,
      p_notes: draft.notes,
      p_days: draft.days,
      p_appointment: draft.appointment || null,
    },
    true
  );
}
export async function finishVisit(
  entry: string,
  revision: number,
  request: string,
  draft: VisitDraft
): Promise<ClinicalResult<null>> {
  if (!validDraft(entry, revision, draft) || !validId(request))
    return failure({ code: "22023" });
  return mutate(
    "clinical_finish",
    {
      p_queue: entry,
      p_revision: revision,
      p_request: request,
      p_notes: draft.notes,
      p_days: draft.days,
      p_appointment: draft.appointment || null,
    },
    true
  );
}
