import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth";
import { findPatients } from "@/lib/clinic-queue";
import { ActionForm } from "../action-form";
import { addToQueue } from "../actions";
import { Icon, SecretaryShell } from "../components";

export const instant = false;

export default async function SearchPatient({ searchParams }: PageProps<"/secretary/search">) {
  const account = await getCurrentAccount();
  if (!account) return null;
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const patients = term ? await findPatients(account.clinicId, term) : [];

  return <SecretaryShell active="search">
    <header className="secretary-subheader"><Link href="/secretary" aria-label="العودة للدور"><Icon name="arrow" /></Link><h1>إضافة مريض للدور</h1></header>
    <div className="secretary-content">
      <p className="secretary-muted">ابحث عن ملف المريض قبل إنشاء ملف جديد.</p>
      <form method="get" className="patient-search-form" action="/secretary/search">
        <label htmlFor="patient-search">اسم المريض أو رقم هاتفه</label>
        <div className="patient-search-input"><Icon name="search" size={20} /><input id="patient-search" name="q" defaultValue={term} maxLength={80} placeholder="ابحث عن مريض" autoComplete="off" /><button type="submit">بحث</button></div>
      </form>
      {term && <section className="patient-results" aria-live="polite"><h2>نتائج البحث ({patients.length})</h2>
        {patients.length ? <ul className="patient-result-list">{patients.map((patient) => <li key={patient.id} className="patient-result">
          <div><strong>{patient.full_name}</strong>{patient.phone && <span dir="ltr">{patient.phone}</span>}</div>
          <ActionForm action={addToQueue} label="إضافة للدور" className="patient-add-form">
            <input type="hidden" name="patientId" value={patient.id} />
            <label htmlFor={`visit-${patient.id}`}>نوع الزيارة</label>
            <select id={`visit-${patient.id}`} name="visitType" defaultValue="follow_up"><option value="follow_up">مراجعة</option><option value="full_exam">كشفية</option></select>
          </ActionForm>
        </li>)}</ul> : <div className="search-empty"><p>لم نجد مريضاً يطابق البحث. تأكد من الاسم أو رقم الهاتف.</p></div>}
      </section>}
      <div className="create-patient-link"><div><strong>مريض جديد؟</strong><p>أنشئ ملفاً ثم أضفه للدور.</p></div><Link href="/secretary/patients/new" className="secretary-outline"><Icon name="plus" size={18} />إنشاء ملف</Link></div>
    </div>
  </SecretaryShell>;
}
