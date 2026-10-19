import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth";
import { findPatients } from "@/lib/clinic-queue";
import { Icon, SecretaryShell } from "../components";

export const instant = false;

export default async function Patients() {
  const account = await getCurrentAccount();
  if (!account) return null;
  const patients = await findPatients(account.clinicId);
  return <SecretaryShell active="patients">
    <header className="secretary-subheader"><Link href="/secretary" aria-label="العودة للدور"><Icon name="arrow" /></Link><h1>المرضى</h1></header>
    <div className="secretary-content"><Link className="secretary-outline patient-list-search" href="/secretary/search"><Icon name="search" size={19} />بحث أو إضافة مريض للدور</Link>
      {patients.length === 100 && <p className="secretary-muted">آخر 100 ملف. استخدم البحث للعثور على الملفات الأقدم.</p>}
      {patients.length ? <ul className="patient-result-list">{patients.map((patient) => <li key={patient.id} className="patient-result"><div><strong>{patient.full_name}</strong>{patient.phone && <span dir="ltr">{patient.phone}</span>}</div></li>)}</ul> : <div className="queue-empty"><h2>لا توجد ملفات مرضى بعد</h2><p>ابدأ بالبحث قبل إنشاء أول ملف.</p><Link href="/secretary/search" className="secretary-primary">البحث عن مريض</Link></div>}
    </div>
  </SecretaryShell>;
}
