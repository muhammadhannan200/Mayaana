import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth";
import { clinicDateLabel, clinicTime, getQueue } from "@/lib/clinic-queue";
import { ActionForm } from "./action-form";
import { sendToDoctor } from "./actions";
import { Icon, SecretaryShell } from "./components";

export const instant = false;

export default async function SecretaryHome({ searchParams }: PageProps<"/secretary">) {
  const account = await getCurrentAccount();
  // The route layout handles unauthenticated and unactivated sessions.
  if (!account) return null;
  const entries = await getQueue(account.clinicId);
  const waiting = entries.filter((entry) => entry.status === "waiting");
  const withDoctor = entries.filter((entry) => entry.status === "with_doctor");
  const { added, sent } = await searchParams;

  return <SecretaryShell active="queue">
    <header className="secretary-header">
      <span className="secretary-bell" aria-hidden="true"><Icon name="bell" /></span>
      <div><h1>دور اليوم</h1><p>{clinicDateLabel()}</p></div>
    </header>
    <div className="secretary-content">
      {(added === "1" || sent === "1") && <p className="secretary-success" role="status">{sent === "1" ? "تم إدخال المريض عند الطبيب." : "تمت إضافة المريض لدور اليوم."}</p>}
      <div className="queue-totals" aria-label="ملخص الدور">
        <div><strong>{waiting.length}</strong><span>بالانتظار</span></div>
        <div><strong>{withDoctor.length}</strong><span>عند الطبيب</span></div>
        <div><strong>0</strong><span>انتهت</span></div>
      </div>
      <section className="queue-section" aria-labelledby="waiting-title">
        <h2 id="waiting-title">بالانتظار الآن ({waiting.length})</h2>
        {waiting.length ? <ol className="queue-list">{waiting.map((entry, index) => <li key={entry.id} className="queue-card">
          <div className="queue-card-top">
            <span className="queue-number"><small>دور</small>{index + 1}</span>
            <div className="queue-person"><strong>{entry.patient.full_name}</strong><span>وصل {clinicTime(entry.arrived_at)}</span></div>
            <span className={entry.visit_type === "full_exam" ? "visit-badge full" : "visit-badge"}>{entry.visit_type === "full_exam" ? "كشفية" : "مراجعة"}</span>
          </div>
          <ActionForm action={sendToDoctor} label="إدخال عند الطبيب" className="queue-card-actions"><input type="hidden" name="entryId" value={entry.id} /></ActionForm>
        </li>)}</ol> : <div className="queue-empty"><span className="queue-empty-icon"><Icon name="queue" size={32} /></span><h3>الدور فارغ الآن</h3><p>ابحث عن مريض موجود أو أنشئ ملفاً جديداً لبدء دور اليوم.</p><Link className="secretary-primary" href="/secretary/search">إضافة مريض للدور</Link></div>}
      </section>
      {withDoctor.length > 0 && <section className="queue-section" aria-labelledby="doctor-title"><h2 id="doctor-title">عند الطبيب ({withDoctor.length})</h2><ul className="queue-list">{withDoctor.map((entry) => <li key={entry.id} className="queue-card doctor-card"><strong>{entry.patient.full_name}</strong><span className="queue-status">عند الطبيب</span></li>)}</ul></section>}
    </div>
    {waiting.length > 0 && <Link className="queue-fab" href="/secretary/search"><Icon name="plus" size={20} />إضافة للدور</Link>}
  </SecretaryShell>;
}
