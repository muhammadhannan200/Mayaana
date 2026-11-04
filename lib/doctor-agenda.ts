import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicAccount } from "./auth";

export type AgendaRow = { patientId: string; name: string; date: string };
export type DoctorAgendaData = { today: AgendaRow[]; overdue: AgendaRow[] };
export type AgendaAppointment = { patientId: string; date: string };

export function damascusDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Damascus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// Compare calendar dates only. A completed visit on the appointment day also
// fulfils it; a later saved appointment supersedes an older appointment.
export function classifyAgenda(
  today: string,
  patients: { id: string; name: string }[],
  appointments: AgendaAppointment[],
  arrived: string[],
  completed: { patientId: string; date: string }[]
): DoctorAgendaData {
  const latest = new Map<string, string>();
  const visited = new Map<string, string>();
  for (const row of appointments)
    if (row.date > (latest.get(row.patientId) ?? ""))
      latest.set(row.patientId, row.date);
  for (const row of completed)
    if (row.date > (visited.get(row.patientId) ?? ""))
      visited.set(row.patientId, row.date);
  const arrivals = new Set(arrived);
  const result: DoctorAgendaData = { today: [], overdue: [] };
  for (const patient of patients) {
    const date = latest.get(patient.id);
    if (
      !date ||
      date > today ||
      arrivals.has(patient.id) ||
      (visited.get(patient.id) ?? "") >= date
    )
      continue;
    result[date === today ? "today" : "overdue"].push({
      patientId: patient.id,
      name: patient.name,
      date,
    });
  }
  for (const rows of [result.today, result.overdue])
    rows.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.name.localeCompare(b.name, "ar") ||
        a.patientId.localeCompare(b.patientId)
    );
  return result;
}

export class AgendaBoundError extends Error {}

function bounded<T>(
  result: { data: T[] | null; error: unknown },
  max: number
): T[] {
  if (result.error) throw result.error;
  if (!result.data || result.data.length > max) throw new AgendaBoundError();
  return result.data;
}

// Caller-scoped client only, never an admin client. All four reads are scoped by
// the server-resolved clinic. Sentinels fail closed instead of classifying a
// partial history (which could falsely label someone overdue).
export async function readDoctorAgenda(
  client: SupabaseClient,
  account: ClinicAccount | null,
  now = new Date()
): Promise<DoctorAgendaData> {
  if (!account || account.role !== "doctor" || account.mustChangePassword)
    throw new Error("Doctor access required");
  const clinic = account.clinicId;
  const today = damascusDate(now);
  const candidates = bounded(
    await client
      .from("appointments")
      .select("patient_id,appointment_date")
      .eq("clinic_id", clinic)
      .lte("appointment_date", today)
      .order("appointment_date", { ascending: false })
      .order("id")
      .limit(201),
    200
  );
  const ids = [...new Set(candidates.map((row) => String(row.patient_id)))];
  const result: DoctorAgendaData = { today: [], overdue: [] };
  // At most two batches, four bounded reads each. No notes, diet, measurements,
  // contact details or visit drafts are selected.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const [patientResult, appointmentResult, queueResult, visitResult] =
      await Promise.all([
        client
          .from("patients")
          .select("id,full_name")
          .eq("clinic_id", clinic)
          .in("id", batch)
          .limit(101),
        client
          .from("appointments")
          .select("patient_id,appointment_date")
          .eq("clinic_id", clinic)
          .in("patient_id", batch)
          .order("appointment_date", { ascending: false })
          .order("id")
          .limit(501),
        client
          .from("daily_queue")
          .select("patient_id")
          .eq("clinic_id", clinic)
          .eq("queue_date", today)
          .in("patient_id", batch)
          .limit(101),
        client
          .from("visits")
          .select("patient_id,completed_at")
          .eq("clinic_id", clinic)
          .in("patient_id", batch)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .order("id")
          .limit(501),
      ]);
    const patients = bounded(patientResult, 100);
    if (patients.length !== batch.length)
      throw new Error("Incomplete agenda patients");
    const data = classifyAgenda(
      today,
      patients.map((row) => ({ id: row.id, name: row.full_name })),
      bounded(appointmentResult, 500).map((row) => ({
        patientId: row.patient_id,
        date: row.appointment_date,
      })),
      bounded(queueResult, 100).map((row) => row.patient_id),
      bounded(visitResult, 500).map((row) => ({
        patientId: row.patient_id,
        date: damascusDate(new Date(row.completed_at)),
      }))
    );
    result.today.push(...data.today);
    result.overdue.push(...data.overdue);
  }
  for (const rows of [result.today, result.overdue])
    rows.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.name.localeCompare(b.name, "ar") ||
        a.patientId.localeCompare(b.patientId)
    );
  return result;
}
