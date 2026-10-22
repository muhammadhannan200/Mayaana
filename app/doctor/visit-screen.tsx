"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDemoClinic, type DemoVisit } from "@/lib/demo-clinic";
import { Icon } from "@/app/secretary/components";
import { measurementFields } from "@/app/secretary/measurements/mock-visits";
import "./visit.css";

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function FinishReview({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    ref.current?.showModal();
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="visit-review"
      aria-labelledby="finish-title"
      onCancel={onClose}
    >
      <h2 id="finish-title">قبل إنهاء الزيارة</h2>
      <p>راجع الملخص. بعد الحفظ يخرج المريض من الدور.</p>
      {children}
    </dialog>
  );
}

export function DoctorVisit({
  entryId,
  demo,
}: {
  entryId: string;
  demo: boolean;
}) {
  const { patients, queue, update } = useDemoClinic();
  const params = useSearchParams();
  const router = useRouter();
  const prefix = demo ? "/demo" : "";
  const href = (path: string) => `${prefix}/doctor${path}`;
  const entry = queue.find((item) => item.id === entryId);
  const patient = patients.find((item) => item.id === entry?.patientId);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ day: string; meal?: string } | null>(
    null
  );
  const [mealType, setMealType] = useState("فطور");
  const [description, setDescription] = useState("");
  const plan = params.get("step") === "plan";
  const completed = entry?.status === "completed";
  const visit: DemoVisit = entry?.visit ?? {
    notes: "",
    days: [],
    appointment: "",
  };
  const appointment =
    visit.appointment || dateAfter(Math.max(1, visit.days.length));
  const meals = visit.days.reduce((sum, day) => sum + day.meals.length, 0);
  const visitHref = href(`/visits/${entryId}`);

  function save(change: (current: DemoVisit) => DemoVisit) {
    update((state) => ({
      ...state,
      queue: state.queue.map((item) =>
        item.id === entryId && item.status === "with_doctor"
          ? {
              ...item,
              visit: change(
                item.visit ?? { notes: "", days: [], appointment: "" }
              ),
            }
          : item
      ),
    }));
    setError("");
  }

  function saveMeal(event: FormEvent) {
    event.preventDefault();
    if (!editing || !description.trim()) return;
    const meal = {
      id: editing.meal ?? crypto.randomUUID(),
      type: mealType,
      description: description.trim(),
    };
    save((current) => ({
      ...current,
      days: current.days.map((day) =>
        day.id === editing.day
          ? {
              ...day,
              meals: editing.meal
                ? day.meals.map((item) =>
                    item.id === editing.meal ? meal : item
                  )
                : [...day.meals, meal],
            }
          : day
      ),
    }));
    setEditing(null);
    setDescription("");
  }

  function finish() {
    const completedAt = new Date().toISOString();
    update((state) => {
      const active = state.queue.find((item) => item.id === entryId);
      if (!active || active.status !== "with_doctor") return state;
      return {
        ...state,
        queue: state.queue.map((item) =>
          item.id === entryId
            ? {
                ...item,
                status: "completed",
                visit: { ...visit, appointment, completedAt },
              }
            : item
        ),
        patients: state.patients.map((record) =>
          record.id === active.patientId
            ? {
                ...record,
                visits: [
                  {
                    id: entryId,
                    number: record.visits.length + 1,
                    date: new Date(completedAt).toLocaleDateString("ar-SY"),
                    detailDate: "زيارة مكتملة · العرض التجريبي",
                    kind: active.kind,
                    measurements: { ...active.measurements },
                  },
                  ...record.visits,
                ],
              }
            : record
        ),
      };
    });
    setReview(false);
    router.replace(visitHref);
  }

  if (
    !entry ||
    !patient ||
    !["with_doctor", "completed"].includes(entry.status)
  )
    return (
      <main className="doctor-shell recovery" dir="rtl">
        <h1>الزيارة غير متاحة</h1>
        <p>أكمل القياسات وأدخل المريض عند الطبيب أولاً.</p>
        <Link className="secretary-primary" href={href("")}>
          العودة للرئيسية
        </Link>
      </main>
    );

  const weight = Number(entry.measurements.weight);
  const previous = patient.visits.find((item) => item.id !== entry.id)
    ?.measurements.weight;
  const delta = previous ? weight - Number(previous) : null;
  const towardsGoal =
    delta !== null && (patient.goal === "زيادة وزن" ? delta > 0 : delta < 0);

  const diet = (
    <section className="visit-diet">
      <div className="visit-section-heading">
        <div>
          <h2>البرنامج الغذائي</h2>
          <small>
            {visit.days.length} أيام · {meals} وجبات
          </small>
        </div>
      </div>
      {visit.days.map((day, index) => (
        <section
          key={day.id}
          className="visit-day"
          aria-label={`اليوم ${index + 1}`}
        >
          <div className="visit-section-heading">
            <h3>اليوم {index + 1}</h3>
            {!completed && (
              <button
                type="button"
                className="visit-icon"
                aria-label={`حذف اليوم ${index + 1}`}
                onClick={() => {
                  save((current) => ({
                    ...current,
                    days: current.days.filter((item) => item.id !== day.id),
                  }));
                  if (editing?.day === day.id) setEditing(null);
                }}
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
          {day.meals.map((meal) => (
            <div key={meal.id} className="visit-meal">
              <div>
                <strong>{meal.type}</strong>
                <p>{meal.description}</p>
              </div>
              {!completed && (
                <div className="visit-meal-actions">
                  <button
                    type="button"
                    className="visit-icon"
                    aria-label={`تعديل ${meal.type}`}
                    onClick={() => {
                      setEditing({ day: day.id, meal: meal.id });
                      setMealType(meal.type);
                      setDescription(meal.description);
                    }}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    type="button"
                    className="visit-icon"
                    aria-label={`حذف ${meal.type}`}
                    onClick={() => {
                      save((current) => ({
                        ...current,
                        days: current.days.map((item) =>
                          item.id === day.id
                            ? {
                                ...item,
                                meals: item.meals.filter(
                                  (m) => m.id !== meal.id
                                ),
                              }
                            : item
                        ),
                      }));
                      if (editing?.meal === meal.id) setEditing(null);
                    }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {!completed &&
            (editing?.day === day.id ? (
              <form className="visit-new-meal" onSubmit={saveMeal}>
                <h3>{editing.meal ? "تعديل الوجبة" : "وجبة جديدة"}</h3>
                <fieldset className="visit-meal-types">
                  <legend className="sr-only">نوع الوجبة</legend>
                  {["فطور", "غداء", "سناك", "عشاء", "أخرى"].map((type) => (
                    <label
                      key={type}
                      className={mealType === type ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name="mealType"
                        checked={mealType === type}
                        onChange={() => setMealType(type)}
                      />
                      {type}
                    </label>
                  ))}
                </fieldset>
                <label className="secretary-field">
                  تفاصيل الوجبة
                  <textarea
                    autoFocus
                    required
                    maxLength={1000}
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                <small>اكتب الوجبة كما تريد أن يقرأها المريض</small>
                <div className="visit-buttons">
                  <button
                    className="secretary-primary"
                    type="submit"
                    disabled={!description.trim()}
                  >
                    {editing.meal ? "حفظ الوجبة" : "إضافة الوجبة"}
                  </button>
                  <button
                    className="secretary-outline"
                    type="button"
                    onClick={() => setEditing(null)}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="visit-dashed"
                type="button"
                onClick={() => {
                  setEditing({ day: day.id });
                  setMealType("فطور");
                  setDescription("");
                }}
              >
                <Icon name="plus" size={18} />
                إضافة وجبة
              </button>
            ))}
        </section>
      ))}
      {!completed && (
        <button
          type="button"
          className="visit-dashed"
          onClick={() =>
            save((current) => ({
              ...current,
              days: [...current.days, { id: crypto.randomUUID(), meals: [] }],
            }))
          }
        >
          <Icon name="plus" size={20} />
          إضافة يوم
        </button>
      )}
      <section className="visit-appointment">
        <h2>موعد المراجعة القادمة</h2>
        {completed ? (
          <p>{appointment}</p>
        ) : (
          <label className="secretary-field">
            تاريخ الموعد
            <input
              type="date"
              min={dateAfter(1)}
              value={appointment}
              onChange={(event) =>
                save((current) => ({
                  ...current,
                  appointment: event.target.value,
                }))
              }
            />
          </label>
        )}
        <small>
          {visit.appointment
            ? "موعد مخصص لهذه الزيارة"
            : "يُحسب تلقائياً: اليوم التالي لنهاية البرنامج"}
        </small>
      </section>
    </section>
  );

  return (
    <main className="doctor-shell visit-shell" dir="rtl">
      <header className="doctor-topbar">
        <div>
          <h1>{completed ? "الزيارة المكتملة" : "زيارة اليوم"}</h1>
          <p>
            {patient.name} · {entry.kind === "full_exam" ? "كشفية" : "مراجعة"}
          </p>
        </div>
        <Link
          className="doctor-back"
          href={href(`/patients/${patient.id}`)}
          aria-label="العودة لملف المريض"
        >
          <Icon name="arrow" size={20} />
        </Link>
      </header>
      {!completed && (
        <nav className="visit-tabs" aria-label="خطوات الزيارة">
          <Link aria-current={!plan ? "page" : undefined} href={visitHref}>
            القياسات والملاحظات
          </Link>
          <Link
            aria-current={plan ? "page" : undefined}
            href={`${visitHref}?step=plan`}
          >
            البرنامج والموعد
          </Link>
        </nav>
      )}
      <div className="visit-content">
        {completed && (
          <p className="secretary-success" role="status">
            اكتملت الزيارة · خرج المريض من الدور.
          </p>
        )}
        {(!plan || completed) && (
          <>
            <section className="visit-weight">
              <div>
                <strong>
                  <bdi>{entry.measurements.weight} كغ</bdi>
                </strong>
                <small>
                  {previous ? `آخر زيارة ${previous} كغ` : "أول زيارة"}
                </small>
              </div>
              {delta !== null && (
                <span
                  className={towardsGoal ? "visit-delta good" : "visit-delta"}
                >
                  <bdi>{Math.abs(delta).toFixed(1)} كغ</bdi> ·{" "}
                  {delta < 0 ? "نزول" : delta > 0 ? "زيادة" : "ثابت"}
                </span>
              )}
            </section>
            <dl className="demo-measurements">
              {measurementFields
                .filter(
                  (field) =>
                    field.key !== "weight" && entry.measurements[field.key]
                )
                .map((field) => (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>
                      <bdi>
                        {entry.measurements[field.key]} {field.unit}
                      </bdi>
                    </dd>
                  </div>
                ))}
            </dl>
            <section className="visit-notes">
              <label htmlFor="visit-notes">ملاحظاتي</label>
              <textarea
                id="visit-notes"
                rows={4}
                maxLength={4000}
                readOnly={completed}
                placeholder="اكتب ملاحظات زيارة اليوم…"
                value={visit.notes}
                onChange={(event) =>
                  save((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </section>
            {!completed && (
              <section>
                <h2>البرنامج الغذائي</h2>
                <Link className="visit-dashed" href={`${visitHref}?step=plan`}>
                  إعداد البرنامج والموعد <Icon name="plus" size={18} />
                </Link>
              </section>
            )}
          </>
        )}
        {(plan || completed) && diet}
        {error && (
          <p className="secretary-error" role="alert">
            {error}
          </p>
        )}
        <p className="demo-flow-note">
          عرض تجريبي · حفظ تلقائي في هذا المتصفح فقط. لا تدخل بيانات حقيقية.
        </p>
      </div>
      <footer className="visit-actionbar">
        {completed ? (
          <Link className="secretary-primary" href={href("")}>
            العودة للرئيسية
          </Link>
        ) : !plan ? (
          <Link className="secretary-primary" href={`${visitHref}?step=plan`}>
            متابعة للبرنامج والموعد
          </Link>
        ) : (
          <button
            className="secretary-primary"
            onClick={() => {
              if (editing) {
                setError("احفظ الوجبة أو ألغِ تعديلها أولاً.");
                return;
              }
              if (
                !visit.days.length ||
                visit.days.some((day) => !day.meals.length)
              ) {
                setError(
                  "أضف يوماً ووجبة واحدة على الأقل لكل يوم قبل الإنهاء."
                );
                return;
              }
              if (appointment <= dateAfter(0)) {
                setError("اختر موعد مراجعة بعد اليوم.");
                return;
              }
              setError("");
              setReview(true);
            }}
          >
            <Icon name="check" size={20} />
            إنهاء الزيارة
          </button>
        )}
      </footer>
      {review && !completed && (
        <FinishReview onClose={() => setReview(false)}>
          <dl className="visit-summary">
            <div>
              <dt>المريض</dt>
              <dd>{patient.name}</dd>
            </div>
            <div>
              <dt>الوزن</dt>
              <dd>{entry.measurements.weight} كغ</dd>
            </div>
            <div>
              <dt>الملاحظات</dt>
              <dd>{visit.notes.trim() ? "مكتوبة" : "بدون ملاحظات"}</dd>
            </div>
            <div>
              <dt>البرنامج الغذائي</dt>
              <dd>
                {visit.days.length} أيام · {meals} وجبات
              </dd>
            </div>
            <div>
              <dt>المراجعة القادمة</dt>
              <dd>{appointment}</dd>
            </div>
          </dl>
          <div className="visit-buttons">
            <button className="secretary-primary" onClick={finish}>
              حفظ وإنهاء الزيارة
            </button>
            <button
              className="secretary-outline"
              onClick={() => setReview(false)}
            >
              رجوع
            </button>
          </div>
        </FinishReview>
      )}
    </main>
  );
}
