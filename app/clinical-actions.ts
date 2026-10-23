"use server";

import { accountForUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  measurementColumns,
  type ClinicalCommand,
  type ClinicalEntry,
  type ClinicalResult,
  type ClinicalSnapshot,
} from "@/lib/clinical-types";

async function session() {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("unauthorized");
  const account = await accountForUser(db, user);
  if (!account || account.mustChangePassword) throw new Error("unauthorized");
  return { db, account };
}

export async function readClinic(): Promise<ClinicalResult<ClinicalSnapshot>> {
  try {
    const { db } = await session();
    // One RPC statement gives a consistent snapshot, including legacy queue rows.
    const { data, error } = await db.rpc("clinical_snapshot");
    if (error) throw error;
    const patients = (data.patients ?? []) as {
      id: string;
      full_name: string;
      phone: string | null;
      height_cm: number | null;
      gender: string | null;
      birth_year: number | null;
      goal: string | null;
    }[];
    const rows = (data.entries ?? []) as {
      id: string;
      patient_id: string;
      visit_id: string | null;
      visit_type: ClinicalEntry["kind"];
      status: ClinicalEntry["status"];
      queue_date: string;
      revision: number;
      arrived_at: string;
      measurements: Record<string, number | null> | null;
    }[];
    return {
      data: {
        patients: patients.map((p) => ({
          id: p.id,
          name: p.full_name,
          phone: p.phone ?? "",
          height: p.height_cm == null ? "" : String(p.height_cm),
          gender: p.gender ?? "",
          birthYear: p.birth_year == null ? "" : String(p.birth_year),
          goal: p.goal ?? "",
        })),
        entries: rows.map((q) => ({
          id: q.id,
          patientId: q.patient_id,
          visitId: q.visit_id,
          kind: q.visit_type,
          status: q.status,
          serviceDate: q.queue_date,
          revision: q.revision,
          arrivalTime: new Date(q.arrived_at).toLocaleTimeString("ar-SY", {
            timeZone: "Asia/Damascus",
            hour: "2-digit",
            minute: "2-digit",
          }),
          measurements: Object.fromEntries(
            Object.entries(measurementColumns).flatMap(([key, column]) =>
              q.measurements?.[column] == null
                ? []
                : [[key, String(q.measurements[column])]]
            )
          ),
        })),
      },
    };
  } catch {
    return {
      error:
        "تعذّر تحميل بيانات العيادة. تحقق من الاتصال أو سجّل الدخول مجدداً.",
    };
  }
}

export async function mutateClinic(
  command: ClinicalCommand
): Promise<ClinicalResult<string>> {
  try {
    const { db, account } = await session();
    if (account.role !== "secretary")
      return { error: "غير مسموح بهذا الإجراء." };
    let result;
    switch (command.type) {
      case "patient":
        result = await db.rpc("clinical_create_patient", {
          p_id: command.patient.id,
          p_name: command.patient.name,
          p_phone: command.patient.phone,
          p_height: command.patient.height,
          p_gender: command.patient.gender,
          p_birth_year: command.patient.birthYear,
          p_goal: command.patient.goal,
        });
        break;
      case "enqueue":
        result = await db.rpc("clinical_enqueue", {
          p_patient: command.patientId,
          p_kind: command.kind,
        });
        break;
      case "measure":
        result = await db.rpc("clinical_save_measurements", {
          p_entry: command.entryId,
          p_revision: command.revision,
          p_request: command.requestId,
          p_values: command.measurements,
        });
        break;
      case "handoff":
        result = await db.rpc("clinical_handoff", {
          p_entry: command.entryId,
          p_revision: command.revision,
        });
        break;
      default:
        return { error: "طلب غير صالح." };
    }
    if (result.error) {
      if (result.error.code === "PT409")
        return {
          error:
            "تغيّرت البيانات من جهاز آخر. أعد التحميل وراجعها قبل المحاولة.",
        };
      if (result.error.code === "23505")
        return { error: "يوجد ملف بهذا الهاتف. ابحث عن الملف الموجود." };
      if (["22023", "23514", "22P02"].includes(result.error.code))
        return { error: "تحقق من البيانات والقياسات المطلوبة ثم حاول مجدداً." };
      return {
        error: "لم يتم الحفظ. تحقق من حالة الدور والصلاحيات ثم حاول مجدداً.",
      };
    }
    return { data: String(result.data) };
  } catch {
    return {
      error: "تعذّر الحفظ. احتفظ بالقيم وأعد المحاولة بعد التحقق من الاتصال.",
    };
  }
}
