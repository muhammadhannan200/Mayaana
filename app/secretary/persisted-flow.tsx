"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { mutateClinic, readClinic } from "@/app/clinical-actions";
import type {
  ClinicalEntry,
  ClinicalPatient,
  ClinicalSnapshot,
} from "@/lib/clinical-types";
import { measurementFields } from "./measurements/mock-visits";
import { MeasurementScreen } from "./measurements/measurement-screen";
import { Icon } from "./components";
import { DoctorNav, SecretaryNav, VisitOptions, VisitType } from "./clinic-ui";
import { patientFieldErrors } from "@/lib/patient-validation";
import "./persisted.css";

const normalize = (value: string) =>
  value
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));

export function PersistedClinicFlow({ route }: { route: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [snapshot, setSnapshot] = useState<ClinicalSnapshot | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [term, setTerm] = useState(params.get("q") ?? "");
  const [kind, setKind] = useState<ClinicalEntry["kind"]>("full_exam");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [goalFilter, setGoalFilter] = useState("");
  const [sentEntry, setSentEntry] = useState<string | null>(null);
  useEffect(() => {
    if (!sentEntry) return;
    const timer = window.setTimeout(() => setSentEntry(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [sentEntry]);
  // Stable across failed requests, including a lost successful response.
  const patientId = useRef<string | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const result = await readClinic();
      if (current !== generation.current) return false;
      if (result.error) {
        setError(result.error);
        return false;
      }
      setSnapshot(result.data!);
      return true;
    } catch {
      if (current === generation.current)
        setError("تعذّر الاتصال. أعد التحميل بعد التحقق من الشبكة.");
      return false;
    }
  }, []);
  useEffect(() => {
    let active = true;
    const invalidate = () => {
      generation.current++;
    };
    const load = () => {
      if (active && !busy.current) void refresh();
    };
    load();
    const timer = window.setInterval(load, 5000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      invalidate();
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [refresh]);

  async function run(
    command: Parameters<typeof mutateClinic>[0],
    destination?: string
  ) {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await mutateClinic(command);
      if (result.error) {
        setError(result.error);
        return false;
      }
      const loaded = await refresh();
      if (!loaded) return false;
      if (destination) router.push(destination.replace("{id}", result.data!));
      return true;
    } catch {
      setError(
        "تعذّر الحفظ. احتفظ بالقيم وأعد المحاولة بعد التحقق من الاتصال."
      );
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const doctor = route.startsWith("doctor");
  const base = doctor ? "/doctor" : "/secretary";
  const patients = snapshot?.patients ?? [];
  const queue = snapshot?.entries ?? [];
  const selected = patients.find((p) => p.id === params.get("patient"));
  const entry = queue.find((q) => q.id === params.get("entry"));
  const matches = patients.filter(
    (p) =>
      `${p.name} ${p.phone}`.includes(normalize(term)) &&
      (!goalFilter || p.goal === goalFilter)
  );
  const patientFor = (q: ClinicalEntry) =>
    patients.find((p) => p.id === q.patientId);
  const badge = (q: ClinicalEntry) => <VisitType kind={q.kind} />;
  const back = (title: string, href = base) => (
    <header className="secretary-subheader">
      <h1>{title}</h1>
      <Link href={href} aria-label="العودة">
        <Icon name="arrow" />
      </Link>
    </header>
  );
  const issue = error ? (
    <p className="secretary-error" role="alert">
      {error}{" "}
      <button
        type="button"
        className="text-link"
        disabled={pending}
        onClick={() => {
          // Explicitly discard the stale editor and acquire a fresh revision.
          window.location.reload();
        }}
      >
        إعادة التحميل
      </button>
    </p>
  ) : null;

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const errors = patientFieldErrors(data);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      event.currentTarget
        .querySelector<HTMLInputElement>(`[name="${Object.keys(errors)[0]}"]`)
        ?.focus();
      return;
    }
    patientId.current ??= crypto.randomUUID();
    const patient: ClinicalPatient = {
      id: patientId.current,
      name: String(data.get("name") ?? "").trim(),
      phone: normalize(String(data.get("phone") ?? "")).replace(/[\s()-]/g, ""),
      height: normalize(String(data.get("height") ?? "")).replace(/[٫,]/g, "."),
      gender: String(data.get("gender") ?? ""),
      birthYear: normalize(String(data.get("birthYear") ?? "")),
      goal: String(data.get("goal") ?? ""),
    };
    await run({ type: "patient", patient }, "/secretary/confirm?patient={id}");
  }

  if (!snapshot)
    return (
      <main className="secretary-shell recovery" dir="rtl">
        <h1>بيانات العيادة</h1>
        {issue ?? <p role="status">جارٍ تحميل بيانات العيادة…</p>}
      </main>
    );

  if (route.includes("/measurements/")) {
    if (!entry || entry.status === "with_doctor")
      return (
        <main className="secretary-shell recovery" dir="rtl">
          <h1>القياسات غير متاحة للتعديل</h1>
          <Link href={base}>العودة للدور</Link>
        </main>
      );
    const patient = patientFor(entry);
    return (
      <LiveMeasurements
        key={entry.id}
        entry={entry}
        patientName={patient?.name ?? ""}
        issue={issue}
        pending={pending}
        save={async (measurements, revision, requestId) =>
          run(
            {
              type: "measure",
              entryId: entry.id,
              revision,
              requestId,
              measurements,
            },
            "/secretary?measured=1"
          )
        }
      />
    );
  }

  let content;
  if (route === "secretary/patients/new")
    content = (
      <>
        {back("ملف مريض جديد")}
        <form
          className="secretary-content new-patient-form"
          onSubmit={create}
          noValidate
          onBlur={(event) => {
            const field = event.target;
            if (!(field instanceof HTMLInputElement)) return;
            const errors = patientFieldErrors(
              new FormData(event.currentTarget)
            );
            setFieldErrors((previous) => ({
              ...previous,
              [field.name]: errors[field.name] ?? "",
            }));
          }}
          inert={pending}
        >
          <label className="secretary-field">
            الاسم الكامل *
            <input
              name="name"
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? "name-error" : undefined}
              required
              minLength={2}
              maxLength={160}
              autoComplete="off"
            />
            {fieldErrors.name && (
              <span className="field-error" id="name-error">
                {fieldErrors.name}
              </span>
            )}
          </label>
          <label className="secretary-field">
            رقم الهاتف *
            <input
              name="phone"
              aria-invalid={!!fieldErrors.phone}
              aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
              type="tel"
              required
              maxLength={20}
              dir="ltr"
              placeholder="09XX XXX XXX"
            />
            {fieldErrors.phone && (
              <span className="field-error" id="phone-error">
                {fieldErrors.phone}
              </span>
            )}
          </label>
          <div className="intake-two-columns">
            <label className="secretary-field">
              الطول *
              <input
                name="height"
                aria-invalid={!!fieldErrors.height}
                aria-describedby={
                  fieldErrors.height ? "height-error" : undefined
                }
                inputMode="decimal"
                required
                placeholder="مثال: 165"
              />
              {fieldErrors.height && (
                <span className="field-error" id="height-error">
                  {fieldErrors.height}
                </span>
              )}
            </label>
            <label className="secretary-field">
              الجنس
              <select name="gender">
                <option value="female">أنثى</option>
                <option value="male">ذكر</option>
              </select>
            </label>
          </div>
          <label className="secretary-field">
            سنة الميلاد
            <input
              name="birthYear"
              inputMode="numeric"
              maxLength={4}
              aria-invalid={!!fieldErrors.birthYear}
              aria-describedby={
                fieldErrors.birthYear ? "birth-year-error" : undefined
              }
            />
            {fieldErrors.birthYear && (
              <span className="field-error" id="birth-year-error">
                {fieldErrors.birthYear}
              </span>
            )}
          </label>
          <fieldset className="goal-options">
            <legend>هدف المتابعة</legend>
            {["نقص وزن", "زيادة وزن"].map((goal, i) => (
              <label key={goal}>
                <input
                  type="radio"
                  name="goal"
                  value={goal}
                  defaultChecked={i === 0}
                />
                {goal}
              </label>
            ))}
          </fieldset>
          {issue}
          <div className="intake-actionbar">
            <button className="secretary-primary" disabled={pending}>
              {pending ? "جارٍ الحفظ…" : "حفظ ومتابعة الإضافة للدور"}
            </button>
            <Link className="secretary-outline" href="/secretary/search">
              إلغاء
            </Link>
          </div>
        </form>
      </>
    );
  else if (route === "secretary/confirm")
    content = (
      <>
        {back("إضافة للدور", "/secretary/search")}
        <div className="secretary-content confirm-content">
          {issue}
          {selected ? (
            <>
              <section className="confirm-patient">
                <div className="confirm-person">
                  <span className="patient-avatar" aria-hidden="true">
                    {selected.name[0]}
                  </span>
                  <div>
                    <h2>{selected.name}</h2>
                    <p>
                      <bdi>{selected.phone}</bdi> · الهدف:{" "}
                      {selected.goal || "غير مسجّل"}
                    </p>
                  </div>
                </div>
              </section>
              <VisitOptions kind={kind} onChange={setKind} />
              <p className="intake-info">أول زيارة تتطلب كشفية كاملة.</p>
              <div className="intake-actionbar">
                {queue.some((q) => q.patientId === selected.id) ? (
                  <p role="status">المريض موجود في دور اليوم بالفعل.</p>
                ) : (
                  <button
                    className="secretary-primary"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        { type: "enqueue", patientId: selected.id, kind },
                        "/secretary?added=1"
                      )
                    }
                  >
                    {pending ? "جارٍ الإضافة…" : "إضافة للدور"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p>اختر ملف المريض أولاً.</p>
              <Link href="/secretary/search">البحث عن مريض</Link>
            </>
          )}
        </div>
      </>
    );
  else if (
    route.includes("/visits/") ||
    (route.includes("/patients/") && !route.endsWith("/new"))
  ) {
    const id = route.split("/")[2];
    const visit = route.includes("/visits/")
      ? queue.find((q) => q.visitId === id || q.id === id)
      : queue.find((q) => q.patientId === id);
    const patient = route.includes("/visits/")
      ? visit && patientFor(visit)
      : patients.find((p) => p.id === id);
    content = (
      <>
        {back(patient?.name ?? "الملف غير متاح")}
        <div className="secretary-content demo-patient-file">
          {issue}
          {patient && (
            <>
              <h2>معلومات المريض</h2>
              <dl className="demo-patient-info">
                <div>
                  <dt>الهاتف</dt>
                  <dd>
                    <bdi>{patient.phone || "—"}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>الطول</dt>
                  <dd>{patient.height || "—"} سم</dd>
                </div>
                <div>
                  <dt>الجنس</dt>
                  <dd>
                    {patient.gender === "female"
                      ? "أنثى"
                      : patient.gender === "male"
                        ? "ذكر"
                        : "غير مسجّل"}
                  </dd>
                </div>
                <div>
                  <dt>سنة الميلاد</dt>
                  <dd>
                    <bdi>{patient.birthYear || "غير مسجّل"}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>هدف المتابعة</dt>
                  <dd>{patient.goal || "غير مسجّل"}</dd>
                </div>
              </dl>
              <h2>قياسات الزيارة</h2>
              {visit ? (
                <>
                  <p>
                    تاريخ الخدمة: <bdi>{visit.serviceDate}</bdi> ·{" "}
                    {visit.status === "with_doctor"
                      ? "عند الطبيب"
                      : visit.status === "ready"
                        ? "جاهز للدخول"
                        : "بانتظار القياس"}
                  </p>
                  <dl className="demo-measurements">
                    {measurementFields
                      .filter((f) => visit.measurements[f.key])
                      .map((f) => (
                        <div key={f.key}>
                          <dt>{f.label}</dt>
                          <dd>
                            <bdi>
                              {visit.measurements[f.key]} {f.unit}
                            </bdi>
                          </dd>
                        </div>
                      ))}
                  </dl>
                </>
              ) : (
                <p>لا توجد زيارة في دور اليوم.</p>
              )}
              {!doctor && (
                <Link
                  className="secretary-primary"
                  href={`/secretary/confirm?patient=${patient.id}`}
                >
                  إضافة للدور
                </Link>
              )}
            </>
          )}
        </div>
      </>
    );
  } else if (route.endsWith("patients") || route.endsWith("search"))
    content = (
      <>
        {route.endsWith("patients") ? (
          <header className="directory-heading">
            <h1>المرضى</h1>
            <p>{patients.length} مريضاً</p>
          </header>
        ) : (
          back(doctor ? "البحث" : "إضافة للدور")
        )}
        <div
          className={`secretary-content search-content${route.endsWith("patients") ? " patient-directory" : ""}`}
        >
          {issue}
          <label className="patient-search-input">
            <Icon name="search" />
            <input
              aria-label="اسم المريض أو رقم هاتفه"
              placeholder="ابحث بالاسم أو رقم الهاتف"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              maxLength={80}
            />
          </label>
          {route.endsWith("patients") && (
            <div
              className="patient-filters"
              role="group"
              aria-label="تصفية حسب هدف المتابعة"
            >
              {["", "نقص وزن", "زيادة وزن"].map((goal) => (
                <button
                  key={goal}
                  type="button"
                  aria-pressed={goalFilter === goal}
                  onClick={() => setGoalFilter(goal)}
                >
                  {goal || "الكل"} (
                  {patients.filter((p) => !goal || p.goal === goal).length})
                </button>
              ))}
            </div>
          )}
          <section aria-live="polite">
            <h2 className={route.endsWith("patients") ? "sr-only" : undefined}>
              نتائج البحث ({matches.length})
            </h2>
            <ul className="patient-result-list">
              {matches.map((p) => (
                <li key={p.id}>
                  <Link
                    className="patient-result patient-result-link"
                    href={
                      doctor || route.endsWith("patients")
                        ? `${base}/patients/${p.id}`
                        : `/secretary/confirm?patient=${p.id}`
                    }
                  >
                    <span className="patient-avatar">{p.name[0]}</span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        <bdi>{p.phone}</bdi>
                      </small>
                    </span>
                    <Icon name="arrow" />
                  </Link>
                </li>
              ))}
            </ul>
            {!matches.length && <p>لا توجد نتائج. جرّب اسماً أو رقماً آخر.</p>}
          </section>
          {!doctor && (
            <Link className="secretary-outline" href="/secretary/patients/new">
              فتح ملف مريض جديد
            </Link>
          )}
        </div>
      </>
    );
  else
    content = (
      <>
        <header className="secretary-header">
          <div>
            <h1>{doctor ? "دور العيادة" : "دور اليوم"}</h1>
            <p>بيانات العيادة المحفوظة</p>
          </div>
        </header>
        <div className="secretary-content">
          {issue}
          {params.has("measured") && (
            <p className="secretary-success" role="status">
              تم حفظ القياسات. المريض جاهز للدخول.
            </p>
          )}
          <div className="queue-totals">
            <div>
              <strong>
                {queue.filter((q) => q.status !== "with_doctor").length}
              </strong>
              <span>بالانتظار</span>
            </div>
            <div>
              <strong>
                {queue.filter((q) => q.status === "with_doctor").length}
              </strong>
              <span>عند الطبيب</span>
            </div>
          </div>
          {doctor &&
            queue
              .filter((q) => q.status === "with_doctor")
              .map((q) => (
                <section className="doctor-current" key={q.id}>
                  <p className="doctor-current-label">
                    <Image
                      src="/rashaqa/doctor-door.svg"
                      width={18}
                      height={18}
                      alt=""
                      unoptimized
                    />
                    عندك الآن
                  </p>
                  <h2>{patientFor(q)?.name ?? "—"}</h2>
                  <p>
                    {q.kind === "full_exam" ? "كشفية" : "مراجعة"} · الوزن{" "}
                    {q.measurements.weight
                      ? `${q.measurements.weight} كغ`
                      : "غير مسجّل"}
                  </p>
                  <Link
                    className="secretary-outline"
                    href={`/doctor/visits/${q.visitId ?? q.id}`}
                  >
                    فتح الزيارة
                  </Link>
                </section>
              ))}
          {doctor && (
            <div className="doctor-statistics">
              <section className="doctor-stat">
                <strong>{patients.length}</strong>
                <h2>إجمالي المرضى</h2>
                <p>كل الملفات</p>
              </section>
            </div>
          )}
          {(["waiting", "ready", "with_doctor"] as const).map((status) =>
            doctor && status === "with_doctor" ? null : (
              <section className="queue-section" key={status}>
                <h2>
                  {status === "waiting"
                    ? "بانتظار القياس"
                    : status === "ready"
                      ? "جاهز للدخول"
                      : "عند الطبيب"}
                </h2>
                <ol className="queue-list">
                  {queue
                    .filter((q) => q.status === status)
                    .map((q, i) => (
                      <li
                        className={`queue-card${sentEntry === q.id ? " recent-handoff" : ""}`}
                        key={q.id}
                      >
                        <div className="queue-card-top">
                          <span className="queue-number">{i + 1}</span>
                          <div className="queue-person">
                            <strong>{patientFor(q)?.name ?? "—"}</strong>
                            <span>
                              <bdi>{q.arrivalTime}</bdi>
                            </span>
                          </div>
                          {badge(q)}
                        </div>
                        <div className="queue-card-actions">
                          {doctor ? (
                            <Link
                              className="secretary-outline"
                              href={`/doctor/visits/${q.visitId ?? q.id}`}
                            >
                              فتح الملف والقياسات
                            </Link>
                          ) : status === "with_doctor" ? (
                            <span
                              role={sentEntry === q.id ? "status" : undefined}
                            >
                              {sentEntry === q.id
                                ? "دخل عند الطبيب · يختفي التنبيه خلال 1 د"
                                : "عند الطبيب"}
                            </span>
                          ) : (
                            <>
                              <Link
                                className="secretary-outline"
                                href={`/secretary/measurements/${q.kind === "full_exam" ? "full-exam" : "follow-up"}?entry=${q.id}`}
                              >
                                {status === "ready"
                                  ? "تعديل القياسات"
                                  : "أخذ القياس"}
                              </Link>
                              {status === "ready" && (
                                <button
                                  className="secretary-primary"
                                  disabled={
                                    pending ||
                                    queue.some(
                                      (entry) => entry.status === "with_doctor"
                                    )
                                  }
                                  title={
                                    queue.some(
                                      (entry) => entry.status === "with_doctor"
                                    )
                                      ? "يوجد مريض عند الطبيب بالفعل"
                                      : undefined
                                  }
                                  onClick={async () => {
                                    const saved = await run({
                                      type: "handoff",
                                      entryId: q.id,
                                      revision: q.revision,
                                    });
                                    if (saved) setSentEntry(q.id);
                                  }}
                                >
                                  {pending
                                    ? "جارٍ الإرسال…"
                                    : "إدخال عند الطبيب"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                </ol>
              </section>
            )
          )}
          {!queue.length && (
            <div className="queue-empty">
              <h2>الدور فارغ الآن</h2>
              <p>لا يوجد مرضى في دور اليوم.</p>
            </div>
          )}
          {!doctor && (
            <Link className="secretary-primary" href="/secretary/search">
              إضافة مريض للدور
            </Link>
          )}
        </div>
      </>
    );
  return (
    <main
      className={`${doctor ? "doctor-shell" : "secretary-shell"} persisted-clinic`}
      dir="rtl"
    >
      <div className="secretary-scroll">{content}</div>
      {doctor ? (
        <DoctorNav route={route} />
      ) : route === "secretary/confirm" ||
        route === "secretary/patients/new" ? null : (
        <SecretaryNav route={route} />
      )}
    </main>
  );
}

function LiveMeasurements({
  entry,
  patientName,
  issue,
  pending,
  save,
}: {
  entry: ClinicalEntry;
  patientName: string;
  issue: React.ReactNode;
  pending: boolean;
  save: (
    values: ClinicalEntry["measurements"],
    revision: number,
    requestId: string
  ) => Promise<boolean>;
}) {
  // Do not silently rebase a dirty editor when polling receives a newer revision.
  const revision = useRef(entry.revision);
  const request = useRef<{ payload: string; id: string } | null>(null);
  return (
    <>
      <MeasurementScreen
        mode={entry.kind === "full_exam" ? "full-exam" : "follow-up"}
        patientName={patientName}
        history={[]}
        draft={entry.measurements}
        closeHref="/secretary"
        readOnlyHistory
        pending={pending}
        externalError={issue}
        onComplete={async (values) => {
          const payload = JSON.stringify(values);
          if (request.current?.payload !== payload)
            request.current = { payload, id: crypto.randomUUID() };
          await save(values, revision.current, request.current!.id);
        }}
      />
    </>
  );
}
