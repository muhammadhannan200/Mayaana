import Link from "next/link";
import { Icon } from "@/frontend/components/icon";
import type { PatientRecord } from "@/shared/clinical-model";

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
        {showResults && results.length > 0 && (
          <h2>نتائج البحث ({results.length})</h2>
        )}
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
          <SearchEmpty
            term={term}
            newPatientHref={href("secretary/patients/new")}
          />
        )}
      </section>
      {(!showResults || results.length > 0) && (
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
      )}
    </div>
  );
}

// No match: name the search and offer a new file, so the page is never blank.
export function SearchEmpty({
  term,
  newPatientHref,
}: {
  term: string;
  newPatientHref?: string;
}) {
  return (
    <div className="queue-empty search-empty">
      <span className="queue-empty-icon">
        <Icon name="patients" size={28} />
      </span>
      <h2>
        ما لقينا <bdi>{term.trim()}</bdi>
      </h2>
      <p>
        جرّب الاسم الأول فقط أو رقم الهاتف.
        {newPatientHref && " إذا أول زيارة، افتح ملف جديد."}
      </p>
      {newPatientHref && (
        <Link className="secretary-primary" href={newPatientHref}>
          فتح ملف مريض جديد
        </Link>
      )}
    </div>
  );
}
