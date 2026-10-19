import Link from "next/link";
import { connection } from "next/server";
import { ActionForm } from "../../action-form";
import { createPatientAndQueue } from "../../actions";
import { Icon, SecretaryShell } from "../../components";

export default async function NewPatient() {
  await connection();
  return <SecretaryShell active="patients">
    <header className="secretary-subheader"><Link href="/secretary/search" aria-label="العودة للبحث"><Icon name="arrow" /></Link><h1>ملف مريض جديد</h1></header>
    <div className="secretary-content">
      <p className="secretary-muted">تأكد من البحث أولاً لتجنب إنشاء ملف مكرر.</p>
      <ActionForm action={createPatientAndQueue} label="حفظ وإضافة للدور" className="new-patient-form">
        <input type="hidden" name="patientId" value={crypto.randomUUID()} />
        <div className="secretary-field"><label htmlFor="new-patient-name">اسم المريض الكامل *</label><input id="new-patient-name" name="name" required minLength={2} maxLength={160} autoComplete="name" placeholder="أدخل اسم المريض" /></div>
        <div className="secretary-field"><label htmlFor="new-patient-phone">رقم الهاتف (اختياري)</label><input id="new-patient-phone" name="phone" type="tel" dir="ltr" minLength={6} maxLength={32} autoComplete="tel" placeholder="رقم للتواصل" /><small>يساعد رقم الهاتف في العثور على الملف لاحقاً.</small></div>
        <div className="secretary-field"><label htmlFor="new-visit-type">نوع الزيارة *</label><select id="new-visit-type" name="visitType" defaultValue="full_exam"><option value="full_exam">كشفية</option><option value="follow_up">مراجعة</option></select></div>
      </ActionForm>
    </div>
  </SecretaryShell>;
}
