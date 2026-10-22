import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAccount } from "@/lib/auth";
import { clinicDay } from "@/lib/clinic-queue";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { DoctorShell } from "../../shell";
import { Icon } from "@/app/secretary/components";

export const instant = false;

export default async function PatientRecord({
  params,
}: PageProps<"/doctor/patients/[id]">) {
  if (!isSupabaseConfigured()) return null;
  const account = await getCurrentAccount();
  if (!account) return null;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: patient, error }, { data: queue, error: queueError }] =
    await Promise.all([
      supabase
        .from("patients")
        .select("id, full_name, phone")
        .eq("id", id)
        .eq("clinic_id", account.clinicId)
        .maybeSingle(),
      supabase
        .from("daily_queue")
        .select("id, status, visit_type")
        .eq("patient_id", id)
        .eq("clinic_id", account.clinicId)
        .eq("queue_date", clinicDay())
        .maybeSingle(),
    ]);
  if (error || queueError) throw new Error("تعذّر تحميل ملف المريض.");
  if (!patient) notFound();

  return (
    <DoctorShell active="patients">
      <header className="doctor-topbar">
        <Link
          href="/doctor"
          aria-label="العودة للرئيسية"
          className="doctor-back"
        >
          <Icon name="arrow" />
        </Link>
        <div>
          <h1>{patient.full_name}</h1>
          <p>ملف المريض</p>
        </div>
      </header>
      <div className="doctor-content doctor-record">
        <section>
          <h2>معلومات المريض</h2>
          <div className="doctor-information">
            <span>الاسم</span>
            <strong>{patient.full_name}</strong>
          </div>
          {patient.phone && (
            <div className="doctor-information">
              <span>رقم الهاتف</span>
              <strong dir="ltr">{patient.phone}</strong>
            </div>
          )}
        </section>
        {queue?.status === "with_doctor" && (
          <div className="doctor-record-state">
            <strong>عند الطبيب الآن</strong>
            <span>{queue.visit_type === "full_exam" ? "كشفية" : "مراجعة"}</span>
          </div>
        )}
        <p className="doctor-record-notice">
          لا يمكن تسجيل القياسات والملاحظات الطبية قبل اعتماد بنية الزيارات
          الآمنة.
        </p>
      </div>
    </DoctorShell>
  );
}
