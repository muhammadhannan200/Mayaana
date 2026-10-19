"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/auth";
import { clinicDay } from "@/lib/clinic-queue";
import { createClient } from "@/lib/supabase/server";

export type QueueActionResult = { error: string } | null;

async function clinicForAction() {
  const account = await getCurrentAccount();
  if (!account) redirect("/");
  if (account.mustChangePassword) redirect("/change-password");
  if (account.role !== "secretary" && account.role !== "doctor") redirect("/");
  return account.clinicId;
}

export async function addToQueue(
  _previous: QueueActionResult,
  form: FormData
): Promise<QueueActionResult> {
  const clinicId = await clinicForAction();
  const patientId = form.get("patientId");
  const visitType = form.get("visitType");
  if (
    typeof patientId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(patientId) ||
    (visitType !== "follow_up" && visitType !== "full_exam")
  ) {
    return { error: "اختر المريض ونوع الزيارة ثم حاول مجدداً." };
  }
  const supabase = await createClient();
  const queueDate = clinicDay();
  const { error } = await supabase.from("daily_queue").insert({
    clinic_id: clinicId,
    patient_id: patientId,
    queue_date: queueDate,
    visit_type: visitType,
  });
  if (error?.code === "23505") {
    const { data: existing } = await supabase
      .from("daily_queue")
      .select("id, visit_type")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .eq("queue_date", queueDate)
      .maybeSingle();
    if (!existing)
      return {
        error: "تعذّر التحقق من قيد الدور الحالي. حدّث الصفحة وحاول مجدداً.",
      };
    if (existing.visit_type !== visitType)
      return { error: "هذا المريض موجود في دور اليوم بنوع زيارة مختلف." };
    revalidatePath("/secretary");
    redirect(`/secretary?existing=${existing.id}`);
  }
  if (error) return { error: "تعذّرت إضافة المريض للدور. حاول مرة أخرى." };
  revalidatePath("/secretary");
  redirect("/secretary?added=1");
}

export async function createPatientAndQueue(
  _previous: QueueActionResult,
  form: FormData
): Promise<QueueActionResult> {
  const clinicId = await clinicForAction();
  const name = form.get("name");
  const phone = form.get("phone");
  const patientId = form.get("patientId");
  const visitType = form.get("visitType");
  if (
    typeof patientId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      patientId
    ) ||
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 160 ||
    typeof phone !== "string" ||
    (phone.trim().length > 0 &&
      (phone.trim().length < 6 || phone.trim().length > 32)) ||
    (visitType !== "follow_up" && visitType !== "full_exam")
  ) {
    return { error: "تحقق من الاسم ورقم الهاتف ونوع الزيارة." };
  }
  const supabase = await createClient();
  const queueDate = clinicDay();
  const normalizedPhone = phone.trim();
  const normalizedName = name.trim();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      id: patientId,
      clinic_id: clinicId,
      full_name: normalizedName,
      phone: normalizedPhone || null,
    })
    .select("id")
    .single();
  let resolvedPatientId = data?.id;
  if (error?.code === "23505") {
    // The form UUID makes a retry identifiable even when the phone is blank.
    const { data: byId, error: idError } = await supabase
      .from("patients")
      .select("id, full_name, phone")
      .eq("clinic_id", clinicId)
      .eq("id", patientId)
      .maybeSingle();
    if (idError) return { error: "تعذّر التحقق من ملف المريض. حاول مرة أخرى." };
    let existing = byId;
    if (!existing && normalizedPhone) {
      const { data: byPhone, error: phoneError } = await supabase
        .from("patients")
        .select("id, full_name, phone")
        .eq("clinic_id", clinicId)
        .eq("phone", normalizedPhone)
        .maybeSingle();
      if (phoneError)
        return { error: "تعذّر التحقق من ملف المريض. حاول مرة أخرى." };
      existing = byPhone;
    }
    if (
      !existing ||
      existing.full_name !== normalizedName ||
      existing.phone !== (normalizedPhone || null)
    )
      return {
        error: "الملف الموجود لا يطابق البيانات المدخلة. ابحث عن المريض وتحقق من ملفه.",
      };
    resolvedPatientId = existing.id;
  }
  if ((error && error.code !== "23505") || !resolvedPatientId) {
    return { error: "تعذّر إنشاء ملف المريض. حاول مرة أخرى." };
  }

  const { error: queueError } = await supabase.from("daily_queue").insert({
    clinic_id: clinicId,
    patient_id: resolvedPatientId,
    queue_date: queueDate,
    visit_type: visitType,
  });
  if (queueError?.code === "23505") {
    const { data: existing } = await supabase
      .from("daily_queue")
      .select("id, visit_type")
      .eq("clinic_id", clinicId)
      .eq("patient_id", resolvedPatientId)
      .eq("queue_date", queueDate)
      .maybeSingle();
    if (!existing)
      return {
        error:
          "تعذّر التحقق من قيد الدور الحالي. ابحث عن المريض قبل المحاولة مجدداً.",
      };
    if (existing.visit_type !== visitType)
      return { error: "هذا المريض موجود في دور اليوم بنوع زيارة مختلف." };
    revalidatePath("/secretary");
    redirect(`/secretary?existing=${existing.id}`);
  }
  if (queueError)
    return {
      error:
        "تم إنشاء ملف المريض، لكن لم يُضف للدور. ابحث عنه وأضفه من شاشة البحث.",
    };
  revalidatePath("/secretary");
  redirect("/secretary?added=1");
}

export async function sendToDoctor(
  _previous: QueueActionResult,
  form: FormData
): Promise<QueueActionResult> {
  const clinicId = await clinicForAction();
  const id = form.get("entryId");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))
    return { error: "لم يتم العثور على المريض في الدور." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_queue")
    .update({ status: "with_doctor" })
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .eq("queue_date", clinicDay())
    .eq("status", "waiting")
    .select("id")
    .maybeSingle();
  if (error || !data)
    return {
      error: "تعذّر إدخال المريض. حدّث الدور وتحقق من حالته ثم حاول مجدداً.",
    };
  revalidatePath("/secretary");
  redirect("/secretary?sent=1");
}
