import "server-only";
import { createClient } from "./supabase/server";
import { accountForUser } from "./auth";
import { printableDays, type PrintResult } from "../shared/print-plan";

// The route ID is a queue-entry ID, matching the existing visit screen.
// Never call getClinicScreen here: its doctor payload includes private notes.
export async function getPrintPlan(entryId: string): Promise<PrintResult> {
  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) return { kind: "denied" };
    const account = await accountForUser(client, user);
    if (!account || account.mustChangePassword || account.role !== "doctor")
      return { kind: "denied" };
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        entryId
      )
    )
      return { kind: "unavailable" };

    // Check actual clinic ownership in addition to staff role and table RLS.
    const clinic = await client
      .from("clinics")
      .select("name")
      .eq("id", account.clinicId)
      .eq("doctor_user_id", user.id)
      .maybeSingle();
    if (clinic.error) throw clinic.error;
    if (!clinic.data) return { kind: "denied" };
    const visit = await client
      .from("visits")
      .select("id,patient_id,completed_at")
      .eq("clinic_id", account.clinicId)
      .eq("queue_entry_id", entryId)
      .maybeSingle();
    if (visit.error) throw visit.error;
    if (!visit.data) return { kind: "unavailable" };
    if (!visit.data.completed_at) return { kind: "incomplete" };

    const [patient, diet, appointment] = await Promise.all([
      client
        .from("patients")
        .select("full_name")
        .eq("clinic_id", account.clinicId)
        .eq("id", visit.data.patient_id)
        .maybeSingle(),
      client
        .from("diet_plans")
        .select("days")
        .eq("clinic_id", account.clinicId)
        .eq("visit_id", visit.data.id)
        .maybeSingle(),
      client
        .from("appointments")
        .select("appointment_date")
        .eq("clinic_id", account.clinicId)
        .eq("originating_visit_id", visit.data.id)
        .maybeSingle(),
    ]);
    for (const result of [patient, diet, appointment])
      if (result.error) throw result.error;
    if (!patient.data || !diet.data) return { kind: "unavailable" };
    return {
      kind: "ready",
      plan: {
        clinicName: clinic.data.name,
        patientName: patient.data.full_name,
        visitDate: visit.data.completed_at,
        days: printableDays(diet.data.days),
        appointment: appointment.data?.appointment_date ?? "",
      },
    };
  } catch {
    // Do not expose backend diagnostics or partially loaded patient data.
    return { kind: "error" };
  }
}
