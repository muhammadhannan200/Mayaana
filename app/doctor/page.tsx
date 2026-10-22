import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth";
import { clinicDateLabel, clinicTime, getQueue } from "@/lib/clinic-queue";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { Icon } from "@/app/secretary/components";
import { DoctorShell } from "./shell";
import { signOut } from "@/app/actions";

export const instant = false;

export default async function DoctorHome() {
  if (!isSupabaseConfigured()) return null;
  const account = await getCurrentAccount();
  // The doctor layout enforces authentication and role on every visit.
  if (!account) return null;
  const [entries, supabase] = await Promise.all([
    getQueue(account.clinicId),
    createClient(),
  ]);
  const current = entries.filter((entry) => entry.status === "with_doctor");
  const waiting = entries.filter((entry) => entry.status === "waiting");
  const { count, error } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", account.clinicId);

  return (
    <DoctorShell active="home">
      <header className="doctor-home-header">
        <form action={signOut}>
          <button
            className="doctor-bell"
            type="submit"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            <Icon name="account" />
          </button>
        </form>
        <div>
          <h1>صباح الخير دكتور</h1>
          <p>{clinicDateLabel()}</p>
        </div>
      </header>
      <div className="doctor-content">
        {current.length > 0 && (
          <section className="doctor-current" aria-label="عندك الآن">
            <p>عندك الآن</p>
            <h2>{current[0].patient.full_name}</h2>
            <p>{current[0].visit_type === "full_exam" ? "كشفية" : "مراجعة"}</p>
            <Link href={`/doctor/patients/${current[0].patient_id}`}>
              فتح الملف
            </Link>
          </section>
        )}
        <div className="doctor-stats">
          <div>
            <strong>{error ? "—" : (count ?? 0)}</strong>
            <span>إجمالي المرضى</span>
            <small>كل الملفات</small>
          </div>
          <div>
            <strong>{entries.length}</strong>
            <span>مرضى اليوم</span>
            <small>في دور اليوم</small>
          </div>
        </div>
        {current.length > 1 && (
          <section className="doctor-queue">
            <h2>عند الطبيب ({current.length})</h2>
            <ul>
              {current.slice(1).map((entry) => (
                <li key={entry.id}>
                  <Link href={`/doctor/patients/${entry.patient_id}`}>
                    <span>
                      {entry.patient.full_name}
                      <small>
                        {entry.visit_type === "full_exam" ? "كشفية" : "مراجعة"}
                      </small>
                    </span>
                    <span className="doctor-ready">عند الطبيب</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="doctor-queue">
          <h2>الدور برّا ({waiting.length})</h2>
          {waiting.length ? (
            <ol>
              {waiting.map((entry, index) => (
                <li key={entry.id}>
                  <span className="doctor-order">{index + 1}</span>
                  <span>
                    {entry.patient.full_name}
                    <small>
                      {entry.visit_type === "full_exam" ? "كشفية" : "مراجعة"} ·
                      وصل {clinicTime(entry.arrived_at)}
                    </small>
                  </span>
                  <span className="doctor-waiting">بالانتظار</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="doctor-empty">لا يوجد مرضى بالانتظار الآن.</p>
          )}
        </section>
      </div>
    </DoctorShell>
  );
}
