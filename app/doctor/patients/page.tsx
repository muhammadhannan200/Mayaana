import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth";
import { findPatients } from "@/lib/clinic-queue";
import { DoctorShell } from "../shell";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const instant = false;

export default async function DoctorPatients() {
  if (!isSupabaseConfigured()) return null;
  const account = await getCurrentAccount();
  if (!account) return null;
  const patients = await findPatients(account.clinicId);
  return (
    <DoctorShell active="patients">
      <header className="doctor-topbar">
        <h1>المرضى</h1>
      </header>
      <div className="doctor-content">
        {!patients.length && (
          <p className="doctor-empty">لا توجد ملفات مرضى بعد.</p>
        )}
        <p className="doctor-record-notice">أحدث 100 ملف مريض.</p>
        <ul className="doctor-patients">
          {patients.map((patient) => (
            <li key={patient.id}>
              <Link href={`/doctor/patients/${patient.id}`}>
                {patient.full_name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </DoctorShell>
  );
}
