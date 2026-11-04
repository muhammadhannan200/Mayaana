import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicAccount } from "./auth";
import type { VisitKind } from "./clinical-model";
import type { DemoState } from "./demo-fixture";
import { damascusDate } from "./doctor-agenda.ts";

export type WeekVisit = {
  id: string;
  patientId: string;
  name: string;
  kind: VisitKind;
  date: string;
  arrivalTime?: string;
};
export type DoctorWeekData = { visits: WeekVisit[]; totalPatients: number };

const limit = 500;

export function weekStart(today: string) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 6);
  return date.toISOString().slice(0, 10);
}

export function groupWeekVisits(visits: WeekVisit[]) {
  const days = new Map<string, WeekVisit[]>();
  for (const visit of [...visits].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.arrivalTime ?? "").localeCompare(a.arrivalTime ?? "")
  ))
    days.set(visit.date, [...(days.get(visit.date) ?? []), visit]);
  return [...days].map(([date, rows]) => ({ date, rows }));
}

export function countWeekKinds(visits: WeekVisit[]) {
  const fullExam = visits.filter((visit) => visit.kind === "full_exam").length;
  return { fullExam, followUp: visits.length - fullExam };
}

// Caller-scoped client only. Selects no notes, diet, measurements or contacts.
export async function readDoctorWeek(
  client: SupabaseClient,
  account: ClinicAccount,
  now = new Date()
): Promise<DoctorWeekData> {
  const today = damascusDate(now);
  const [queue, patients] = await Promise.all([
    client
      .from("daily_queue")
      .select("id,patient_id,visit_type,queue_date,arrived_at")
      .eq("clinic_id", account.clinicId)
      .gte("queue_date", weekStart(today))
      .lte("queue_date", today)
      .order("arrived_at", { ascending: false })
      .limit(limit),
    client
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", account.clinicId),
  ]);
  if (queue.error) throw queue.error;
  if (patients.error) throw patients.error;
  const ids = [...new Set((queue.data ?? []).map((r) => String(r.patient_id)))];
  const names = new Map<string, string>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await client
      .from("patients")
      .select("id,full_name")
      .eq("clinic_id", account.clinicId)
      .in("id", ids.slice(offset, offset + 100));
    if (error) throw error;
    for (const row of data ?? []) names.set(String(row.id), row.full_name);
  }
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Damascus",
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    totalPatients: patients.count ?? 0,
    visits: (queue.data ?? []).map((row) => ({
      id: String(row.id),
      patientId: String(row.patient_id),
      name: names.get(String(row.patient_id)) ?? "مريض",
      kind: row.visit_type as VisitKind,
      date: String(row.queue_date),
      arrivalTime: time.format(new Date(String(row.arrived_at))),
    })),
  };
}

// Fictional local records only. The demo queue is its current-day queue.
export function demoWeek(state: DemoState, today: string): DoctorWeekData {
  const start = weekStart(today);
  const name = (id: string) =>
    state.patients.find((patient) => patient.id === id)?.name ?? "مريض";
  const visits: WeekVisit[] = state.queue.map((entry) => ({
    id: entry.id,
    patientId: entry.patientId,
    name: name(entry.patientId),
    kind: entry.kind,
    date: today,
    arrivalTime: entry.arrivalTime,
  }));
  for (const patient of state.patients)
    for (const visit of patient.visits) {
      const date = visit.serviceDate ?? visit.date;
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date >= start && date < today)
        visits.push({
          id: visit.id,
          patientId: patient.id,
          name: patient.name,
          kind: visit.kind,
          date,
        });
    }
  return { visits, totalPatients: state.patients.length };
}
