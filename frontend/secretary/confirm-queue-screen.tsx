import Link from "next/link";
import { Icon } from "@/frontend/components/icon";
import type { PatientRecord, QueueEntry } from "@/shared/clinical-model";
import { VisitOptions } from "./clinic-ui";
import { displayDate } from "@/shared/clinic-dates";

type VisitKind = QueueEntry["kind"];

export function ConfirmQueueScreen({
  selected,
  queued,
  demo,
  kind,
  visitKind,
  onKind,
  pending,
  href,
  onEnqueue,
}: {
  selected?: PatientRecord;
  queued: boolean;
  demo: boolean;
  kind: VisitKind;
  visitKind: VisitKind;
  onKind: (kind: VisitKind) => void;
  pending?: boolean;
  href: (route: string) => string;
  onEnqueue: (id: string, kind: VisitKind) => void;
}) {
  return (
    <div className="secretary-content">
      {selected ? (
        <>
          <section className="confirm-patient">
            <div className="patient-result-link">
              <span className="patient-avatar">{selected.name[0]}</span>
              <div>
                <h2>{selected.name}</h2>
                <p>
                  <bdi>{selected.phone}</bdi> · الهدف: {selected.goal}
                </p>
              </div>
            </div>
            <div className="confirm-stats">
              <div>
                <strong>{selected.visits.length}</strong>
                <small>عدد الزيارات</small>
              </div>
              <div>
                <strong>
                  {selected.visits[0]
                    ? displayDate(selected.visits[0].date)
                    : "—"}
                </strong>
                <small>آخر زيارة</small>
              </div>
              <div>
                <strong>
                  {selected.visits[0]?.measurements.weight ?? "—"}
                </strong>
                <small>آخر وزن</small>
              </div>
            </div>
          </section>
          {queued ? (
            <p className="secretary-success">
              المريض موجود في دور اليوم بالفعل.
            </p>
          ) : (
            <>
              {!demo ? (
                <VisitOptions
                  kind={visitKind}
                  onChange={onKind}
                  firstVisit={selected.visits.length === 0}
                />
              ) : (
                <>
                  <h2 className="visit-title">نوع الزيارة</h2>
                  <fieldset className="visit-options">
                    <legend className="sr-only">نوع الزيارة</legend>
                    {(["full_exam", "follow_up"] as const).map((value) => (
                      <label
                        key={value}
                        className={visitKind === value ? "selected" : ""}
                      >
                        <input
                          type="radio"
                          name="visitType"
                          checked={visitKind === value}
                          disabled={
                            selected.visits.length === 0 &&
                            value === "follow_up"
                          }
                          onChange={() => onKind(value)}
                        />
                        <span>
                          <strong>
                            {value === "full_exam" ? "كشفية" : "مراجعة"}
                          </strong>
                          <small>
                            {value === "full_exam"
                              ? "وزن + قياس كامل للجسم (دهون، عضل، محيطات)"
                              : "وزن فقط"}
                          </small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </>
              )}
              <p className="intake-info">
                <Icon name="info" size={18} />
                {selected.visits.length === 0
                  ? "أول زيارة تُسجّل كشفية مع قياس كامل."
                  : "اختر نوع الزيارة حسب المطلوب اليوم."}
              </p>
            </>
          )}
          <div className="intake-actionbar">
            {queued ? (
              <Link className="secretary-primary" href={href("secretary")}>
                العودة للدور
              </Link>
            ) : (
              <button
                className="secretary-primary"
                disabled={pending}
                onClick={() =>
                  onEnqueue(
                    selected.id,
                    selected.visits.length === 0 ? "full_exam" : kind
                  )
                }
              >
                <Icon name="check" size={20} />
                إضافة للدور
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p>اختر ملف المريض أولاً.</p>
          <Link className="secretary-primary" href={href("secretary/search")}>
            البحث عن مريض
          </Link>
        </>
      )}
    </div>
  );
}
