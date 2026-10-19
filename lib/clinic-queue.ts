import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Patient = { id: string; full_name: string; phone: string | null };
export type QueueEntry = {
  id: string;
  patient_id: string;
  visit_type: "follow_up" | "full_exam";
  status: "waiting" | "with_doctor";
  arrived_at: string;
  patient: Patient;
};

// The first release operates in the clinic's Syrian local day; make this
// clinic-configurable before supporting clinics in other time zones.
export function clinicDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Damascus", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function clinicDateLabel(now = new Date()) {
  return new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus", weekday: "long", day: "numeric", month: "long",
  }).format(now);
}

export function clinicTime(iso: string) {
  return new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus", hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));
}

export async function getQueue(clinicId: string): Promise<QueueEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("daily_queue")
    .select("id, patient_id, visit_type, status, arrived_at, patient:patients!daily_queue_clinic_id_patient_id_fkey(id, full_name, phone)")
    .eq("clinic_id", clinicId).eq("queue_date", clinicDay())
    .order("arrived_at", { ascending: true }).order("id", { ascending: true });
  if (error) throw new Error("تعذّر تحميل دور اليوم. حاول تحديث الصفحة.");
  return (data ?? []) as unknown as QueueEntry[];
}

export async function findPatients(clinicId: string, term = ""): Promise<Patient[]> {
  const supabase = await createClient();
  const needle = term.trim().slice(0, 80);
  if (!needle) {
    const { data, error } = await supabase.from("patients")
      .select("id, full_name, phone").eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error("تعذّر تحميل المرضى. حاول مرة أخرى.");
    return data ?? [];
  }
  // ilike is a dedicated PostgREST filter, not a composed .or() expression.
  // Escape SQL wildcards so a typed name or phone is searched literally.
  const pattern = `%${needle.replace(/[\\%_]/g, "\\$&")}%`;
  const [names, phones] = await Promise.all([
    supabase.from("patients").select("id, full_name, phone").eq("clinic_id", clinicId).ilike("full_name", pattern).limit(100),
    supabase.from("patients").select("id, full_name, phone").eq("clinic_id", clinicId).ilike("phone", pattern).limit(100),
  ]);
  if (names.error || phones.error) throw new Error("تعذّر البحث عن المرضى. حاول مرة أخرى.");
  return [...new Map([...(names.data ?? []), ...(phones.data ?? [])].map((patient) => [patient.id, patient])).values()];
}
