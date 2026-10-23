"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { signOut } from "@/app/actions";
import {
  useDemoClinic,
  type DemoPatient,
  type DemoEntry,
} from "@/lib/demo-clinic";
import { Icon } from "./components";
import { MeasurementScreen } from "./measurements/measurement-screen";
import { DoctorVisit } from "@/app/doctor/visit-screen";
import { measurementFields } from "./measurements/mock-visits";
import "./secretary.css";
import { PersistedClinicFlow } from "./persisted-flow";

export function ClinicFlow(props: { route: string; demo?: boolean }) {
  return (
    <Suspense fallback={<p className="secretary-muted">جارٍ تحميل العرض…</p>}>
      {props.demo ? (
        <Flow {...props} />
      ) : (
        <PersistedClinicFlow route={props.route} />
      )}
    </Suspense>
  );
}

function Flow({ route, demo = false }: { route: string; demo?: boolean }) {
  const { patients, queue, update, reset } = useDemoClinic();
  const router = useRouter();
  const params = useSearchParams();
  const href = (path: string) => `${demo ? "/demo" : ""}/${path}`;
  const [term, setTerm] = useState(params.get("q") ?? "");
  const [kind, setKind] = useState<DemoEntry["kind"]>("full_exam");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("نقص وزن");
  const [error, setError] = useState("");
  const selected = patients.find((p) => p.id === params.get("patient"));
  const visitKind = selected?.visits.length === 0 ? "full_exam" : kind;
  const entry = queue.find((e) => e.id === params.get("entry"));
  const patient = patients.find((p) => p.id === entry?.patientId);
  const go = (path: string) => router.push(href(path));
  const waiting = queue.filter(
    (e) => e.status === "waiting" || e.status === "ready"
  );
  const current = queue.filter((e) => e.status === "with_doctor");
  const completed = queue.filter((e) => e.status === "completed");
  const normalize = (value: string) =>
    value
      .trim()
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
  const matches = patients.filter((p) =>
    `${p.name} ${p.phone}`.includes(normalize(term))
  );
  const findPatient = (e: DemoEntry) =>
    patients.find((p) => p.id === e.patientId)!;

  function enqueue(id: string, visitKind: DemoEntry["kind"]) {
    update((state) =>
      state.queue.some((e) => e.patientId === id)
        ? state
        : {
            ...state,
            queue: [
              ...state.queue,
              {
                id: crypto.randomUUID(),
                patientId: id,
                kind: visitKind,
                status: "waiting",
                arrivalTime: new Date().toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                measurements: {},
              },
            ],
          }
    );
    go("secretary?added=1");
  }
  function createPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const phone = normalize(String(data.get("phone") ?? "")).replace(
      /[\s()-]/g,
      ""
    );
    const height = normalize(String(data.get("height") ?? ""));
    const birthYear = normalize(String(data.get("birthYear") ?? ""));
    if (
      name.trim().length < 2 ||
      !/^\+?\d{6,15}$/.test(phone) ||
      !Number.isFinite(Number(height)) ||
      Number(height) < 50 ||
      Number(height) > 250 ||
      (birthYear &&
        (!/^\d{4}$/.test(birthYear) ||
          Number(birthYear) < 1900 ||
          Number(birthYear) > new Date().getFullYear()))
    ) {
      setError("تحقق من الاسم والهاتف والطول (50–250 سم) وسنة الميلاد.");
      return;
    }
    if (patients.some((p) => p.phone === phone)) {
      setError("يوجد ملف بهذا الهاتف. اختر الملف الموجود من البحث.");
      return;
    }
    const id = crypto.randomUUID();
    const record: DemoPatient = {
      id,
      name: name.trim(),
      phone,
      height,
      gender: String(data.get("gender")),
      birthYear,
      goal,
      visits: [],
    };
    update((state) => ({ ...state, patients: [...state.patients, record] }));
    go(`secretary/confirm?patient=${id}`);
  }

  if (route.includes("/measurements/")) {
    if (
      !entry ||
      !patient ||
      entry.status === "with_doctor" ||
      entry.status === "completed"
    )
      return (
        <main className="secretary-shell recovery" dir="rtl">
          <h1>اختر مريضاً من الدور</h1>
          <Link className="secretary-primary" href={href("secretary")}>
            العودة للدور
          </Link>
        </main>
      );
    const mode = route.endsWith("previous")
      ? "previous"
      : entry.kind === "full_exam"
        ? "full-exam"
        : "follow-up";
    return (
      <MeasurementScreen
        key={`${entry.id}-${mode}`}
        mode={mode}
        patientName={patient.name}
        history={patient.visits}
        draft={entry.measurements}
        closeHref={href("secretary")}
        historyHref={href(`secretary/measurements/previous?entry=${entry.id}`)}
        onDraftChange={(measurements) =>
          update((state) => ({
            ...state,
            queue: state.queue.map((e) =>
              e.id === entry.id ? { ...e, measurements, status: "waiting" } : e
            ),
          }))
        }
        onHistoryChange={(visits) =>
          update((state) => ({
            ...state,
            patients: state.patients.map((p) =>
              p.id === patient.id ? { ...p, visits } : p
            ),
          }))
        }
        onComplete={(measurements) => {
          update((state) => ({
            ...state,
            queue: state.queue.map((e) =>
              e.id === entry.id ? { ...e, measurements, status: "ready" } : e
            ),
          }));
          go("secretary?measured=1");
        }}
      />
    );
  }

  if (route.startsWith("doctor/visits/"))
    return <DoctorVisit entryId={route.split("/")[2]} demo={demo} />;

  const doctor = route.startsWith("doctor");
  const active = doctor
    ? route.includes("patients")
      ? "patients"
      : "queue"
    : route.includes("search") || route.includes("confirm")
      ? "search"
      : route.includes("patients")
        ? "patients"
        : route.endsWith("account")
          ? "account"
          : "queue";
  const nav = doctor
    ? [
        { id: "queue", label: "الرئيسية", path: "doctor" },
        { id: "patients", label: "المرضى", path: "doctor/patients" },
        {
          id: "account",
          label: "الحساب",
          path: demo ? "secretary/account" : "doctor/staff",
        },
      ]
    : [
        { id: "queue", label: "الدور", path: "secretary" },
        { id: "patients", label: "المرضى", path: "secretary/patients" },
        { id: "search", label: "البحث", path: "secretary/search" },
        { id: "account", label: "الحساب", path: "secretary/account" },
      ];
  const subheader = (title: string, back = "secretary") => (
    <header className="secretary-subheader">
      <h1>{title}</h1>
      <Link href={href(back)} aria-label="العودة">
        <Icon name={doctor ? "arrow" : "close"} />
      </Link>
    </header>
  );
  const badge = (e: DemoEntry) => (
    <span className={`visit-badge${e.kind === "full_exam" ? " full" : ""}`}>
      {e.kind === "full_exam" ? "كشفية" : "مراجعة"}
    </span>
  );
  let content: React.ReactNode;

  if (route === "secretary")
    content = (
      <>
        <header className="secretary-header">
          <div>
            <h1>دور اليوم</h1>
            <p>
              {demo
                ? "عرض تجريبي · جميع البيانات خيالية"
                : "العيادة · دور اليوم"}
            </p>
          </div>
          <span className="secretary-bell">
            <Icon name="bell" />
          </span>
        </header>
        <div className="secretary-content">
          {(params.has("added") ||
            params.has("measured") ||
            params.has("sent")) && (
            <p className="secretary-success" role="status">
              {params.has("sent")
                ? "تم إدخال المريض عند الطبيب."
                : params.has("measured")
                  ? "تم حفظ القياسات. المريض جاهز للدخول."
                  : "تمت إضافة المريض للدور."}
            </p>
          )}
          <div className="queue-totals">
            <div>
              <strong>{waiting.length}</strong>
              <span>بالانتظار</span>
            </div>
            <div>
              <strong>{current.length}</strong>
              <span>عند الطبيب</span>
            </div>
            <div>
              <strong>{completed.length}</strong>
              <span>انتهت</span>
            </div>
          </div>
          <section className="queue-section">
            <h2>بالانتظار الآن ({waiting.length})</h2>
            {waiting.length ? (
              <ol className="queue-list">
                {waiting.map((e, i) => (
                  <li className="queue-card" key={e.id}>
                    <div className="queue-card-top">
                      <span className="queue-number">
                        <small>دور</small>
                        {i + 1}
                      </span>
                      <div className="queue-person">
                        <strong>{findPatient(e).name}</strong>
                        <span>
                          {e.status === "ready"
                            ? "جاهز للدخول"
                            : Object.keys(e.measurements).length
                              ? "القياسات غير مكتملة"
                              : "بانتظار القياس"}{" "}
                          · الزيارة {findPatient(e).visits.length + 1}
                          {e.arrivalTime && (
                            <>
                              {" "}
                              · <bdi>{e.arrivalTime}</bdi>
                            </>
                          )}
                        </span>
                      </div>
                      {badge(e)}
                    </div>
                    <div className="queue-card-actions">
                      {e.status === "ready" ? (
                        <>
                          <button
                            className="secretary-primary"
                            onClick={() => {
                              update((state) => ({
                                ...state,
                                queue: state.queue.map((item) =>
                                  item.id === e.id && item.status === "ready"
                                    ? { ...item, status: "with_doctor" }
                                    : item
                                ),
                              }));
                              go("secretary?sent=1");
                            }}
                          >
                            إدخال عند الطبيب
                          </button>
                          <Link
                            className="queue-edit"
                            href={href(
                              `secretary/measurements/${e.kind === "full_exam" ? "full-exam" : "follow-up"}?entry=${e.id}`
                            )}
                          >
                            تعديل القياسات
                          </Link>
                        </>
                      ) : (
                        <Link
                          className="secretary-outline"
                          href={href(
                            `secretary/measurements/${e.kind === "full_exam" ? "full-exam" : "follow-up"}?entry=${e.id}`
                          )}
                        >
                          <Icon name="scale" size={18} />
                          أخذ القياس
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="queue-empty">
                <span className="queue-empty-icon">
                  <Icon name="queue" size={32} />
                </span>
                <h3>الدور فارغ الآن</h3>
                <p>أضف مريضاً لبدء دور اليوم.</p>
                <Link
                  className="secretary-primary"
                  href={href("secretary/search")}
                >
                  إضافة مريض للدور
                </Link>
              </div>
            )}
          </section>
          {current.length > 0 && (
            <section className="queue-section">
              <h2>عند الطبيب ({current.length})</h2>
              <ul className="queue-list">
                {current.map((e) => (
                  <li key={e.id} className="queue-card doctor-card">
                    <strong>{findPatient(e).name}</strong>
                    <span className="queue-status">عند الطبيب</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {completed.length > 0 && (
            <section className="queue-section">
              <h2>انتهت ({completed.length})</h2>
              <ul className="queue-list">
                {completed.map((e) => (
                  <li key={e.id} className="queue-card doctor-card">
                    <strong>{findPatient(e).name}</strong>
                    <span className="queue-status">اكتملت الزيارة</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <DemoNote demo={demo} href={href("doctor")} />
        </div>
        {queue.length > 0 && (
          <Link className="queue-fab" href={href("secretary/search")}>
            <Icon name="plus" size={20} />
            إضافة للدور
          </Link>
        )}
      </>
    );
  else if (route === "secretary/search" || route === "secretary/patients")
    content = (
      <>
        {subheader(route.endsWith("search") ? "إضافة للدور" : "المرضى")}
        <div className="secretary-content search-content">
          <label className="patient-search-input">
            <Icon name="search" size={20} />
            <input
              aria-label="اسم المريض أو رقم هاتفه"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهاتف"
              maxLength={80}
            />
          </label>
          <section className="patient-results" aria-live="polite">
            <h2>نتائج البحث ({matches.length})</h2>
            <ul className="patient-result-list">
              {matches.map((p) => (
                <li key={p.id}>
                  <Link
                    className="patient-result patient-result-link"
                    href={href(`secretary/confirm?patient=${p.id}`)}
                  >
                    <span className="patient-avatar">{p.name[0]}</span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        <bdi>{p.phone}</bdi> ·{" "}
                        {p.visits.length
                          ? `عدد الزيارات ${p.visits.length}`
                          : "ملف جديد"}
                      </small>
                    </span>
                    <Icon name="arrow" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
            {!matches.length && (
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
      </>
    );
  else if (route === "secretary/confirm")
    content = (
      <>
        {subheader("إضافة للدور", "secretary/search")}
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
                    <strong>{selected.visits[0]?.date ?? "—"}</strong>
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
              {queue.some((e) => e.patientId === selected.id) ? (
                <p className="secretary-success">
                  المريض موجود في دور اليوم بالفعل.
                </p>
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
                          onChange={() => setKind(value)}
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
                  <p className="intake-info">
                    <Icon name="info" size={18} />
                    {selected.visits.length === 0
                      ? "أول زيارة تُسجّل كشفية مع قياس كامل."
                      : "اختر نوع الزيارة حسب المطلوب اليوم."}
                  </p>
                </>
              )}
              <div className="intake-actionbar">
                {queue.some((e) => e.patientId === selected.id) ? (
                  <Link className="secretary-primary" href={href("secretary")}>
                    العودة للدور
                  </Link>
                ) : (
                  <button
                    className="secretary-primary"
                    onClick={() =>
                      enqueue(
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
              <Link
                className="secretary-primary"
                href={href("secretary/search")}
              >
                البحث عن مريض
              </Link>
            </>
          )}
        </div>
      </>
    );
  else if (route === "secretary/patients/new")
    content = (
      <>
        {subheader("ملف مريض جديد", "secretary/search")}
        <form
          className="secretary-content new-patient-form"
          onSubmit={createPatient}
        >
          <label className="secretary-field">
            الاسم الكامل *
            <input
              required
              minLength={2}
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </label>
          {name.trim().length > 1 &&
            patients.some((p) => p.name.includes(name.trim())) && (
              <div className="similar-patient">
                <strong>يوجد مريض باسم مشابه</strong>
                <p>هل هو نفس الشخص؟ أضفه للدور بدل فتح ملف جديد.</p>
                <Link
                  href={href(
                    `secretary/search?q=${encodeURIComponent(name.trim())}`
                  )}
                >
                  عرض الملفات المشابهة
                </Link>
              </div>
            )}
          <label className="secretary-field">
            رقم الهاتف *
            <input
              name="phone"
              type="tel"
              required
              maxLength={20}
              dir="ltr"
              placeholder="09XX XXX XXX"
            />
          </label>
          <div className="intake-two-columns">
            <label className="secretary-field">
              الطول *
              <input
                name="height"
                inputMode="decimal"
                required
                placeholder="مثال: 165 سم"
              />
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
              placeholder="مثال: 1990"
            />
          </label>
          <fieldset className="goal-options">
            <legend>هدف المتابعة</legend>
            {["نقص وزن", "زيادة وزن"].map((value) => (
              <label key={value} className={goal === value ? "selected" : ""}>
                <input
                  type="radio"
                  name="goal"
                  checked={goal === value}
                  onChange={() => setGoal(value)}
                />
                <Icon name="down" />
                <span>{value}</span>
              </label>
            ))}
          </fieldset>
          <p className="intake-info">
            <Icon name="info" size={18} />
            أول زيارة تُسجّل كشفية مع قياس كامل.
          </p>
          {error && (
            <p className="secretary-error" role="alert">
              {error}
            </p>
          )}
          <div className="intake-actionbar">
            <button className="secretary-primary" type="submit">
              <Icon name="check" size={20} />
              حفظ ومتابعة الإضافة للدور
            </button>
            <Link className="secretary-outline" href={href("secretary/search")}>
              إلغاء
            </Link>
          </div>
        </form>
      </>
    );
  else if (route === "secretary/account")
    content = (
      <>
        {subheader("الحساب")}
        <div className="secretary-content">
          <h2>العرض التجريبي V1</h2>
          <p className="secretary-muted">
            بيانات خيالية محفوظة في هذا المتصفح فقط. لا تدخل بيانات مرضى حقيقية.
            قد لا تبقى البيانات بعد إعادة التحميل إذا كان تخزين المتصفح محظوراً.
          </p>
          <Link className="secretary-outline" href={href("secretary")}>
            العودة للدور
          </Link>
          {demo && (
            <button
              className="secretary-outline"
              onClick={() => {
                if (
                  window.confirm(
                    "إعادة بيانات العرض الخيالية؟ ستُحذف تعديلات العرض في هذا المتصفح فقط."
                  )
                ) {
                  reset();
                  go("secretary");
                }
              }}
            >
              إعادة ضبط العرض التجريبي
            </button>
          )}
          {!demo && (
            <form action={signOut}>
              <button className="secretary-primary signout">
                تسجيل الخروج
              </button>
            </form>
          )}
          <DemoNote demo={demo} href={href("doctor")} />
        </div>
      </>
    );
  else if (route === "doctor")
    content = (
      <>
        <header className="doctor-home-header">
          <div>
            <h1>صباح الخير دكتور</h1>
            <p>دور اليوم</p>
          </div>
          {!demo && (
            <form action={signOut}>
              <button className="doctor-bell" aria-label="تسجيل الخروج">
                <Icon name="account" />
              </button>
            </form>
          )}
        </header>
        <div className="doctor-content">
          {current[0] && (
            <section className="doctor-current">
              <p>عندك الآن</p>
              <h2>{findPatient(current[0]).name}</h2>
              {badge(current[0])}
              <Link href={href(`doctor/patients/${current[0].patientId}`)}>
                فتح الملف
              </Link>
            </section>
          )}
          <div className="doctor-stats">
            <div>
              <strong>{patients.length}</strong>
              <span>إجمالي المرضى</span>
              <small>ملفات تجريبية</small>
            </div>
            <div>
              <strong>{queue.length}</strong>
              <span>مرضى اليوم</span>
              <small>في دور اليوم</small>
            </div>
          </div>
          <section className="doctor-queue">
            <h2>عند الطبيب ({current.length})</h2>
            {current.length ? (
              <ul>
                {current.map((e) => (
                  <li key={e.id}>
                    <Link href={href(`doctor/patients/${e.patientId}`)}>
                      <span>
                        {findPatient(e).name}
                        <small>{e.measurements.weight} كغ</small>
                      </span>
                      <span className="doctor-ready">عند الطبيب</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="doctor-empty">لا يوجد مريض عند الطبيب الآن.</p>
            )}
          </section>
          <section className="doctor-queue">
            <h2>الدور برّا ({waiting.length})</h2>
            <ol>
              {waiting.map((e, i) => (
                <li key={e.id}>
                  <span className="doctor-order">{i + 1}</span>
                  <span>
                    {findPatient(e).name}
                    <small>
                      {e.status === "ready" ? "جاهز للدخول" : "بانتظار القياس"}
                    </small>
                  </span>
                  {badge(e)}
                </li>
              ))}
            </ol>
          </section>
          {completed.length > 0 && (
            <section className="doctor-queue">
              <h2>الزيارات المكتملة ({completed.length})</h2>
              <ul>
                {completed.map((e) => (
                  <li key={e.id}>
                    <Link href={href(`doctor/visits/${e.id}`)}>
                      <span>{findPatient(e).name}</span>
                      <span className="doctor-ready">اكتملت الزيارة</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <DemoNote demo={demo} href={href("secretary")} secretary />
        </div>
      </>
    );
  else if (route === "doctor/patients")
    content = (
      <>
        {subheader("المرضى", "doctor")}
        <div className="secretary-content search-content doctor-patient-list">
          <label className="patient-search-input">
            <Icon name="search" size={20} />
            <input
              aria-label="اسم المريض أو رقم هاتفه"
              placeholder="ابحث بالاسم أو رقم الهاتف"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              maxLength={80}
            />
          </label>
          <p className="secretary-muted">إجمالي المرضى ({matches.length})</p>
          <ul className="patient-result-list">
            {matches.map((p) => (
              <li key={p.id}>
                <Link
                  className="patient-result patient-result-link"
                  href={href(`doctor/patients/${p.id}`)}
                >
                  <span className="patient-avatar">{p.name[0]}</span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.visits[0] ? (
                        <>
                          آخر زيارة <bdi>{p.visits[0].date}</bdi> ·{" "}
                          <bdi>{p.visits[0].measurements.weight} كغ</bdi>
                        </>
                      ) : (
                        "زيارة أولى اليوم"
                      )}
                    </small>
                  </span>
                  <Icon name="arrow" />
                </Link>
              </li>
            ))}
          </ul>
          {matches.length === 0 && (
            <p className="secretary-muted">
              لا توجد نتائج. جرّب اسماً أو رقماً آخر.
            </p>
          )}
        </div>
      </>
    );
  else {
    const record = patients.find((p) => p.id === route.split("/")[2]);
    const today = queue.find((e) => e.patientId === record?.id);
    const latest =
      today && today.status !== "waiting"
        ? today.measurements
        : record?.visits[0]?.measurements;
    const startingWeight = record?.visits.at(-1)?.measurements.weight;
    const change =
      latest?.weight && startingWeight
        ? Number(latest.weight) - Number(startingWeight)
        : null;
    content = (
      <>
        {subheader(record?.name ?? "الملف غير موجود", "doctor")}
        <div className="secretary-content demo-patient-file">
          {record ? (
            <>
              {latest?.weight && (
                <section className="patient-progress">
                  <h2>التقدم منذ البداية</h2>
                  <p>
                    <strong>
                      <bdi>{latest.weight}</bdi>
                    </strong>{" "}
                    كغ
                    {startingWeight && (
                      <small>
                        {" "}
                        من <bdi>{startingWeight}</bdi>
                      </small>
                    )}
                  </p>
                  {change !== null && (
                    <span>
                      {change < 0 ? "نزول" : change > 0 ? "زيادة" : "ثبات"}{" "}
                      <bdi>{Math.abs(change).toFixed(1)}</bdi> كغ ·{" "}
                      {record.visits.length} زيارات سابقة
                    </span>
                  )}
                </section>
              )}
              <section>
                <h2>معلومات المريض</h2>
                <dl className="demo-patient-info">
                  <div>
                    <dt>الهدف</dt>
                    <dd>{record.goal}</dd>
                  </div>
                  <div>
                    <dt>الطول</dt>
                    <dd>{record.height} سم</dd>
                  </div>
                  {record.birthYear && (
                    <div>
                      <dt>العمر التقريبي</dt>
                      <dd>
                        {new Date().getFullYear() - Number(record.birthYear)}{" "}
                        سنة
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>الهاتف التجريبي</dt>
                    <dd>
                      <bdi>{record.phone}</bdi>
                    </dd>
                  </div>
                </dl>
              </section>
              {today &&
                (today.status === "with_doctor" ||
                  today.status === "completed") && (
                  <Link
                    className="secretary-primary"
                    href={href(`doctor/visits/${today.id}`)}
                  >
                    {today.status === "completed"
                      ? "عرض الزيارة المكتملة"
                      : "زيارة اليوم"}
                  </Link>
                )}
              <h2>قياسات اليوم</h2>
              {today && today.status !== "waiting" ? (
                <dl className="demo-measurements">
                  {measurementFields
                    .filter((f) => today.measurements[f.key])
                    .map((f) => (
                      <div key={f.key}>
                        <dt>{f.label}</dt>
                        <dd>
                          <bdi>
                            {today.measurements[f.key]} {f.unit}
                          </bdi>
                        </dd>
                      </div>
                    ))}
                </dl>
              ) : (
                <p>لم تُستكمل قياسات اليوم بعد.</p>
              )}
              <h2>الزيارات السابقة ({record.visits.length})</h2>
              <ul className="demo-visit-history">
                {record.visits.map((v) => (
                  <li key={v.id}>
                    <span>
                      {v.date}
                      <small>
                        {v.kind === "full_exam" ? "كشفية" : "مراجعة"} · الزيارة{" "}
                        {v.number}
                      </small>
                    </span>
                    <bdi>{v.measurements.weight} كغ</bdi>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>اختر مريضاً من القائمة.</p>
          )}
          <Link className="secretary-primary" href={href("doctor")}>
            العودة للرئيسية
          </Link>
        </div>
      </>
    );
  }
  const showNav =
    ["secretary", "secretary/patients", "secretary/account"].includes(route) ||
    doctor;
  return (
    <main className={doctor ? "doctor-shell" : "secretary-shell"} dir="rtl">
      <div
        className={
          showNav
            ? doctor
              ? "doctor-scroll"
              : "secretary-scroll"
            : "intake-scroll"
        }
      >
        {content}
      </div>
      {showNav && (
        <nav className="secretary-nav" aria-label="التنقل الرئيسي">
          {nav.map((item) => (
            <Link
              key={item.id}
              className={`secretary-nav-item${active === item.id ? " active" : ""}`}
              aria-current={active === item.id ? "page" : undefined}
              href={href(item.path)}
            >
              <span className="secretary-nav-icon">
                <Icon
                  name={item.id as "queue" | "patients" | "search" | "account"}
                />
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </main>
  );
}

function DemoNote({
  demo,
  href,
  secretary = false,
}: {
  demo: boolean;
  href: string;
  secretary?: boolean;
}) {
  return (
    <p className="demo-flow-note">
      عرض تجريبي · بيانات خيالية في هذا المتصفح فقط.
      {demo && (
        <Link href={href}>{secretary ? "عرض السكرتيرة" : "عرض الطبيب"}</Link>
      )}
    </p>
  );
}
