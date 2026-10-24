import "server-only";
import { createClient } from "./supabase/server";
import { accountForUser } from "./auth";
import type {
  ClinicalFailure,
  ClinicalResult,
  ClinicalSnapshot,
  PatientInput,
  ScreenRequest,
} from "./clinical-types";
import type { DemoVisit } from "./demo-clinic";
import type {
  MockVisit,
  VisitMeasurement,
} from "@/app/secretary/measurements/mock-visits";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId = (id: unknown): id is string =>
  typeof id === "string" && uuidPattern.test(id);
export const normalizeClinicalNumber = (value: string) =>
  value
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace("٫", ".");
const invalid = () => {
  throw { code: "22023" };
};
function failure(error: unknown): ClinicalFailure {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (["AUTH", "42501", "PGRST301", "PGRST302", "PGRST303"].includes(code))
    return {
      ok: false,
      kind: "auth",
      message: "انتهت الجلسة أو لم يعد لديك صلاحية. سجّل الدخول مجدداً.",
    };
  if (["PT409", "40001", "23505", "55000"].includes(code))
    return {
      ok: false,
      kind: "conflict",
      message:
        "تغيّرت البيانات في جلسة أخرى. احتفظ بمدخلاتك وحدّث البيانات قبل المحاولة مجدداً.",
    };
  if (["22023", "22P02", "22007", "23514", "23502", "23503"].includes(code))
    return {
      ok: false,
      kind: "validation",
      message: "تعذّر الحفظ. تحقق من البيانات المطلوبة والقياسات والموعد.",
    };
  return {
    ok: false,
    kind: "network",
    message:
      "تعذّر الاتصال بالخدمة. لم يتم تأكيد الحفظ. احتفظ بمدخلاتك وحاول مجدداً.",
  };
}
async function session(doctor = false) {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw { code: "AUTH" };
  const account = await accountForUser(client, user);
  if (
    !account ||
    account.mustChangePassword ||
    (doctor && account.role !== "doctor")
  )
    throw { code: "AUTH" };
  return { client, account };
}
async function attempt<T>(
  operation: () => Promise<T>
): Promise<ClinicalResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return failure(error);
  }
}
async function mutate(
  name: string,
  args: Record<string, unknown>,
  doctor = false
): Promise<ClinicalResult<null>> {
  return attempt(async () => {
    const { client } = await session(doctor);
    const { error } = await client.rpc(name, args);
    if (error) throw error;
    return null;
  });
}
const measurementStrings = (
  values: Record<string, number> | null | undefined
): VisitMeasurement =>
  Object.fromEntries(
    Object.entries(values ?? {}).map(([key, value]) => [key, String(value)])
  );

async function readBatches<Row>(
  ids: string[],
  query: (
    batch: string[]
  ) => PromiseLike<{ data: Row[] | null; error: unknown }>
): Promise<Row[]> {
  const responses = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) =>
      query(ids.slice(index * 100, index * 100 + 100))
    )
  );
  const rows: Row[] = [];
  for (const response of responses) {
    if (response.error) throw response.error;
    rows.push(...(response.data ?? []));
  }
  return rows;
}

export async function getClinicScreen(
  input: ScreenRequest
): Promise<ClinicalResult<ClinicalSnapshot>> {
  return attempt(async () => {
    if (
      !input ||
      typeof input.term !== "string" ||
      input.term.length > 160 ||
      !Number.isInteger(input.page) ||
      input.page < 0 ||
      input.page > 100000 ||
      (input.patient && !validId(input.patient)) ||
      (input.entry && !validId(input.entry))
    )
      invalid();
    const { client, account } = await session();
    const clinic = account.clinicId;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Damascus",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const term = normalizeClinicalNumber(input.term)
      .replace(/[^\p{L}\p{N}\s+]/gu, " ")
      .trim();
    let patientQuery = client
      .from("patients")
      .select("id,full_name,phone,height_cm,gender,birth_year,goal,revision")
      .eq("clinic_id", clinic)
      .order("full_name")
      .order("id")
      .range(input.page * 50, input.page * 50 + 50);
    if (term)
      patientQuery = patientQuery.or(
        `full_name.ilike.%${term}%,phone.ilike.%${term}%`
      );
    const patientsResult = await patientQuery;
    if (patientsResult.error) throw patientsResult.error;
    let queueQuery = client
      .from("daily_queue")
      .select("id,patient_id,visit_type,status,arrived_at,queue_date,revision")
      .eq("clinic_id", clinic)
      .order("arrived_at")
      .limit(501);
    queueQuery = input.entry
      ? queueQuery.or(`queue_date.eq.${date},id.eq.${input.entry}`)
      : queueQuery.eq("queue_date", date);
    const queueResult = await queueQuery;
    if (queueResult.error) throw queueResult.error;
    if (queueResult.data.length > 500)
      throw new Error("Queue exceeds operational page bound");
    const selectedIds = [
      ...new Set([
        ...queueResult.data.map((row) => row.patient_id as string),
        ...(input.patient ? [input.patient] : []),
      ]),
    ];
    const missingIds = selectedIds.filter(
      (id) => !patientsResult.data.slice(0, 50).some((row) => row.id === id)
    );
    const additional = await readBatches(missingIds, (batch) =>
      client
        .from("patients")
        .select("id,full_name,phone,height_cm,gender,birth_year,goal,revision")
        .eq("clinic_id", clinic)
        .in("id", batch)
    );
    const hasMore = patientsResult.data.length > 50;
    const patientRows = [...patientsResult.data.slice(0, 50), ...additional];
    const entryPatient = queueResult.data.find(
      (row) => row.id === input.entry
    )?.patient_id;
    const detailPatient = input.patient ?? entryPatient;
    const visits = {
      data: await readBatches(
        queueResult.data.map((row) => row.id as string),
        (batch) =>
          client
            .from("visits")
            .select("id,patient_id,queue_entry_id,completed_at,created_at")
            .eq("clinic_id", clinic)
            .in("queue_entry_id", batch)
            .order("created_at", { ascending: false })
            .limit(501)
      ),
    };
    if (detailPatient) {
      const history = await client
        .from("visits")
        .select("id,patient_id,queue_entry_id,completed_at,created_at")
        .eq("clinic_id", clinic)
        .eq("patient_id", detailPatient)
        .not("completed_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (history.error) throw history.error;
      for (const row of history.data)
        if (!visits.data.some((v) => v.id === row.id)) visits.data.push(row);
    }
    const visitIds = visits.data.map((row) => row.id as string);
    const measured = await readBatches(visitIds, (batch) =>
      client
        .from("visit_measurements")
        .select("visit_id,measurements")
        .eq("clinic_id", clinic)
        .in("visit_id", batch)
    );
    const measurements = new Map(
      measured.map((row) => [
        row.visit_id,
        measurementStrings(row.measurements),
      ])
    );
    const visitKinds = new Map(
      queueResult.data.map((row) => [row.id, row.visit_type])
    );
    const historyQueueIds = visits.data
      .filter((v) => v.completed_at && !visitKinds.has(v.queue_entry_id))
      .map((v) => v.queue_entry_id as string);
    if (historyQueueIds.length) {
      const historical = await client
        .from("daily_queue")
        .select("id,visit_type")
        .eq("clinic_id", clinic)
        .in("id", historyQueueIds);
      if (historical.error) throw historical.error;
      historical.data.forEach((row) => visitKinds.set(row.id, row.visit_type));
    }
    const queue = queueResult.data.map((row) => {
      const v = visits.data.find((item) => item.queue_entry_id === row.id);
      return {
        id: row.id as string,
        patientId: row.patient_id as string,
        kind: row.visit_type as "full_exam" | "follow_up",
        status: row.status as "waiting" | "ready" | "with_doctor" | "completed",
        revision: row.revision as number,
        visitId: v?.id as string | undefined,
        arrivalTime: new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Damascus",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(row.arrived_at)),
        measurements: measurements.get(v?.id) ?? {},
      };
    });
    const selectedVisit = queue.find((row) => row.id === input.entry);
    if (account.role === "doctor" && selectedVisit?.visitId) {
      const id = selectedVisit.visitId;
      const [notes, diet, appointment] = await Promise.all([
        client
          .from("visit_private_notes")
          .select("notes")
          .eq("visit_id", id)
          .maybeSingle(),
        client
          .from("diet_plans")
          .select("days")
          .eq("visit_id", id)
          .maybeSingle(),
        client
          .from("appointments")
          .select("appointment_date")
          .eq("originating_visit_id", id)
          .maybeSingle(),
      ]);
      for (const result of [notes, diet, appointment])
        if (result.error) throw result.error;
      Object.assign(selectedVisit, {
        visit: {
          notes: notes.data?.notes ?? "",
          days: diet.data?.days ?? [],
          appointment: appointment.data?.appointment_date ?? "",
          completedAt:
            visits.data.find((v) => v.id === id)?.completed_at ?? undefined,
        },
      });
    }
    return {
      clinicId: clinic,
      role: account.role,
      serviceDate: date,
      hasMore,
      queue,
      patients: patientRows.map((row) => ({
        id: row.id,
        name: row.full_name,
        phone: row.phone ?? "",
        height: row.height_cm == null ? "" : String(row.height_cm),
        gender: row.gender ?? "",
        birthYear: row.birth_year == null ? "" : String(row.birth_year),
        goal: row.goal ?? "",
        revision: row.revision,
        visits: visits.data
          .filter((v) => v.patient_id === row.id && v.completed_at)
          .map((v, index) => ({
            id: v.queue_entry_id,
            number: index + 1,
            date: String(v.completed_at).slice(0, 10),
            detailDate: String(v.completed_at).slice(0, 16).replace("T", " · "),
            kind: visitKinds.get(v.queue_entry_id),
            measurements: measurements.get(v.id) ?? {},
          })) as MockVisit[],
      })),
    };
  });
}

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
  values: VisitMeasurement
): Promise<ClinicalResult<null>> {
  if (
    !validId(entry) ||
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
    p_queue: entry,
    p_revision: revision,
    p_values: normalized,
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
function validDraft(entry: string, revision: number, draft: DemoVisit) {
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
  draft: DemoVisit
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
  draft: DemoVisit
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
