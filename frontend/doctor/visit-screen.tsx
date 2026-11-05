"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDemoClinic } from "@/frontend/demo/demo-clinic";
import { dietPlanMessage, whatsappUrl } from "@/shared/whatsapp";
import { measurementFields, type VisitDraft } from "@/shared/clinical-model";
import { damascusDate } from "@/shared/doctor-agenda";
import { Icon } from "@/frontend/components/icon";
import { VisitAttachments } from "./visit-attachments";
import { useMealEditor, VisitDiet } from "./visit-diet";
import { FinishReview } from "./visit-finish-review";
import "./visit.css";
import type {
  ClinicalOperations,
  ClinicalSnapshot,
  ClinicEntry,
} from "@/shared/clinical-types";

function dateAfter(days: number, base?: string) {
  const date = base ? new Date(`${base}T12:00:00`) : new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DoctorVisit({
  entryId,
  demo,
  clinical,
  operations,
}: {
  entryId: string;
  demo: boolean;
  clinical?: ClinicalSnapshot;
  operations?: ClinicalOperations;
}) {
  return demo ? (
    <DemoDoctorVisit entryId={entryId} />
  ) : (
    <VisitEditor
      entryId={entryId}
      demo={false}
      clinical={clinical}
      operations={operations}
    />
  );
}

function DemoDoctorVisit({ entryId }: { entryId: string }) {
  const local = useDemoClinic();
  return <VisitEditor entryId={entryId} demo local={local} />;
}

function VisitEditor({
  entryId,
  demo,
  clinical,
  operations,
  local,
}: {
  entryId: string;
  demo: boolean;
  clinical?: ClinicalSnapshot;
  operations?: ClinicalOperations;
  local?: ReturnType<typeof useDemoClinic>;
}) {
  const { patients, queue } = clinical ?? local!;
  const update: ReturnType<typeof useDemoClinic>["update"] =
    local?.update ??
    (() => {
      throw new Error("Authenticated visits require clinical operations");
    });
  const params = useSearchParams();
  const router = useRouter();
  const prefix = demo ? "/demo" : "";
  const href = (path: string) => `${prefix}/doctor${path}`;
  const entry = queue.find((item) => item.id === entryId);
  const patient = patients.find((item) => item.id === entry?.patientId);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const plan = params.get("step") === "plan";
  const completed = entry?.status === "completed";
  const needsOpen = entry?.status === "with_doctor" && !entry.doctorOpened;
  useEffect(() => {
    if (!needsOpen) return;
    if (operations) void operations.openVisit(entryId);
    else local?.openVisit(entryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOpen, entryId]);
  const [draft, setDraft] = useState<{
    visit: VisitDraft;
    revision: number;
  } | null>(null);
  const visit: VisitDraft = (!demo && !completed && draft?.visit) ||
    entry?.visit || {
      notes: "",
      days: [],
      appointment: "",
    };
  function appointmentOn(date?: string) {
    return (
      visit.appointment ||
      (completed ? "" : dateAfter(Math.max(1, visit.days.length), date))
    );
  }
  const appointment = appointmentOn(
    demo ? local!.today : clinical?.serviceDate
  );
  const meals = visit.days.reduce((sum, day) => sum + day.meals.length, 0);
  const visitHref = href(`/visits/${entryId}`);
  const revision = (entry as ClinicEntry | undefined)?.revision ?? 0;
  const stale = !!draft && draft.revision !== revision;
  function save(change: (current: VisitDraft) => VisitDraft) {
    if (operations) {
      if (completed || operations.pending) return;
      setDraft((current) => ({
        visit: change(current?.visit ?? visit),
        revision: current?.revision ?? revision,
      }));
      setError("");
      return;
    }
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
  const editor = useMealEditor(save);
  const { editing, description } = editor;
  useEffect(() => {
    if (demo || (!draft && !(editing && description.trim()))) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const leave = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]");
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.pathname === window.location.pathname
      )
        return;
      if (!window.confirm("لديك تعديلات غير محفوظة. مغادرة الزيارة؟")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [demo, draft, editing, description]);

  async function finish() {
    if (operations) {
      if (
        await operations.finishVisit(entryId, draft?.revision ?? revision, {
          ...visit,
          appointment,
        })
      ) {
        setDraft(null);
        setReview(false);
        router.replace(visitHref);
      }
      return;
    }
    // A suspended tab or open confirmation can cross midnight before timers or
    // resume events run. Recheck demo dates at the final local write boundary.
    const today = local!.currentDate();
    const completedAppointment = appointmentOn(today);
    if (completedAppointment <= dateAfter(0, today)) {
      setReview(false);
      setError("اختر موعد مراجعة بعد اليوم.");
      return;
    }
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
                visit: {
                  ...visit,
                  appointment: completedAppointment,
                  completedAt,
                },
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
                    serviceDate: damascusDate(new Date(completedAt)),
                    appointment: completedAppointment,
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

  const whatsappLink = whatsappUrl(
    patient.phone,
    dietPlanMessage({
      patientName: patient.name,
      days: visit.days,
      appointment: visit.appointment,
    })
  );

  return (
    <main className="doctor-shell visit-shell" dir="rtl">
      <header className="doctor-topbar">
        {completed && (
          // Start a fresh document: client navigation retains hidden visit
          // markup (including notes) in Next's mounted route cache.
          <a
            className="doctor-back visit-header-action"
            href={`${visitHref}/print`}
            aria-label="طباعة البرنامج"
          >
            <Icon name="print" size={20} />
          </a>
        )}
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
      <fieldset
        className="visit-content clinical-fieldset"
        disabled={operations?.pending}
      >
        {!demo && !completed && (
          <section className="clinical-draft">
            <p role="status">
              {operations?.pending
                ? "جارٍ الحفظ…"
                : draft
                  ? "تعديلات غير محفوظة · احفظ المسودة قبل مغادرة الزيارة."
                  : "النسخة المحفوظة في العيادة."}
            </p>
            {stale && (
              <p className="secretary-error" role="alert">
                تغيّرت الزيارة في جلسة أخرى. لم تُستبدل تعديلاتك. راجع النسخة
                المحفوظة قبل المتابعة.
              </p>
            )}
            <button
              type="button"
              className="secretary-outline"
              disabled={!draft || operations?.pending || stale || !!editing}
              onClick={async () => {
                if (
                  operations &&
                  (await operations.saveDoctorDraft(
                    entryId,
                    draft?.revision ?? revision,
                    { ...visit, appointment }
                  ))
                )
                  setDraft(null);
              }}
            >
              حفظ المسودة
            </button>
            {stale && (
              <button
                type="button"
                className="secretary-outline"
                onClick={() => {
                  if (window.confirm("إلغاء تعديلاتك وتحميل النسخة المحفوظة؟"))
                    setDraft(null);
                }}
              >
                تحميل النسخة المحفوظة وإلغاء تعديلاتي
              </button>
            )}
          </section>
        )}
        {completed && (
          <p className="secretary-success" role="status">
            اكتملت الزيارة · خرج المريض من الدور.
          </p>
        )}
        {!demo && completed && draft && (
          <section className="secretary-error" role="alert">
            <p>
              أُغلقت الزيارة في جلسة أخرى. المعروض أدناه هو السجل المحفوظ؛ لم
              تُحفظ تعديلات مسودتك.
            </p>
            <details>
              <summary>ملاحظات مسودتي غير المحفوظة</summary>
              <textarea
                aria-label="ملاحظات المسودة غير المحفوظة"
                readOnly
                value={draft.visit.notes}
              />
            </details>
          </section>
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
            {completed && (
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
            )}
            <section className="visit-notes">
              <label htmlFor="visit-notes">ملاحظاتي</label>
              <textarea
                id="visit-notes"
                rows={4}
                maxLength={4000}
                readOnly={completed}
                disabled={operations?.pending}
                placeholder="اكتب ملاحظات زيارة اليوم…"
                value={visit.notes}
                onChange={(event) =>
                  save((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </section>
            <VisitAttachments
              entry={entryId}
              demo={demo}
              readOnly={completed}
            />
          </>
        )}
        {(plan || completed) && (
          <VisitDiet
            visit={visit}
            meals={meals}
            completed={completed}
            demo={demo}
            pending={operations?.pending}
            appointment={appointment}
            minAppointment={dateAfter(
              1,
              demo ? local!.today : clinical?.serviceDate
            )}
            save={save}
            editor={editor}
          />
        )}
        {error && (
          <p className="secretary-error" role="alert">
            {error}
          </p>
        )}
        {demo && (
          <p className="demo-flow-note">
            عرض تجريبي · حفظ تلقائي في هذا المتصفح فقط. لا تدخل بيانات حقيقية.
          </p>
        )}
      </fieldset>
      <footer
        className={`visit-actionbar${completed ? " visit-actionbar-done" : ""}`}
      >
        {completed ? (
          <>
            <Link className="secretary-outline" href={href("")}>
              العودة للرئيسية
            </Link>
            {whatsappLink && (
              <a
                className="secretary-primary"
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                إرسال عبر واتساب
              </a>
            )}
          </>
        ) : !plan ? (
          <Link className="secretary-primary" href={`${visitHref}?step=plan`}>
            متابعة للبرنامج والموعد
          </Link>
        ) : (
          <button
            className="secretary-primary"
            disabled={operations?.pending || stale}
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
              const date = demo ? local!.currentDate() : clinical?.serviceDate;
              const currentAppointment = demo
                ? appointmentOn(date)
                : appointment;
              if (currentAppointment <= dateAfter(0, date)) {
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
        <FinishReview
          patientName={patient.name}
          weight={entry.measurements.weight}
          hasNotes={!!visit.notes.trim()}
          days={visit.days.length}
          meals={meals}
          appointment={appointment}
          disabled={operations?.pending}
          stale={stale}
          onFinish={finish}
          onClose={() => setReview(false)}
        />
      )}
    </main>
  );
}
