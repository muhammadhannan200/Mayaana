import Link from "next/link";
import { Icon } from "@/components/icon";
import type { PatientRecord } from "@/lib/clinical-model";

export function PatientSearchScreen({
  route,
  term,
  onTerm,
  showResults,
  results,
  href,
}: {
  route: string;
  term: string;
  onTerm: (term: string) => void;
  showResults: boolean;
  results: PatientRecord[];
  href: (route: string) => string;
}) {
  return (
    <div
      className={`secretary-content search-content${
        route.endsWith("add") ? " add-to-queue" : ""
      }`}
    >
      <label className="patient-search-input">
        <Icon name="search" size={20} />
        <input
          aria-label="اسم المريض أو رقم هاتفه"
          value={term}
          onChange={(e) => onTerm(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الهاتف"
          maxLength={80}
        />
      </label>
      <section className="patient-results" aria-live="polite">
        {showResults && <h2>نتائج البحث ({results.length})</h2>}
        <ul className="patient-result-list">
          {results.map((p) => (
            <li key={p.id}>
              <Link
                className="patient-result patient-result-link"
                href={href(
                  route === "secretary/patients"
                    ? `secretary/patients/${p.id}`
                    : `secretary/confirm?patient=${p.id}`
                )}
              >
                <span className="patient-avatar">{p.name[0]}</span>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    <bdi>{p.phone}</bdi> ·{" "}
                    {p.visits.length
                      ? `عدد الزيارات ${p.visits.length}`
                      : "زيارة أولى"}
                  </small>
                </span>
                <Icon name="arrow" size={18} />
              </Link>
            </li>
          ))}
        </ul>
        {showResults && !results.length && (
          <div className="queue-empty">
            <Icon name="search" size={32} />
            <h3>لا توجد نتائج</h3>
            <p>جرّب اسماً أو رقم هاتف آخر، أو افتح ملفاً جديداً.</p>
          </div>
        )}
      </section>
      <div className="create-patient-link">
        <strong>ما لقيت المريض؟</strong>
        <p>إذا أول مرة يزور العيادة، افتح له ملف جديد.</p>
        <Link
          className="secretary-outline"
          href={href("secretary/patients/new")}
        >
          <Icon name="plus" size={18} />
          فتح ملف مريض جديد
        </Link>
      </div>
    </div>
  );
}
