"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { useDemoClinic } from "@/lib/demo-clinic";
import { Icon } from "@/components/icon";
import { Toast } from "@/components/toast";
import type { AccountProfile } from "@/lib/account-profile";
import {
  parsePatientFields,
  type PatientFieldErrors,
} from "@/lib/patient-validation";
import { FieldError } from "./field-error";
import { SecretaryAccount } from "./account-screen";
import { PatientEditForm } from "./patient-edit-form";
import { PatientFile } from "./patient-file";
import { DoctorNav } from "@/app/doctor/doctor-nav";
import { MeasurementScreen } from "./measurements/measurement-screen";
import { DoctorVisit } from "@/app/doctor/visit-screen";
import { DoctorHome } from "@/app/doctor/doctor-home";
import { DoctorWeek } from "@/app/doctor/doctor-week";
import { DoctorPatientList } from "@/app/doctor/patient-list";
import { DoctorPatientRecord } from "@/app/doctor/patient-record";
import { type PatientRecord, type QueueEntry } from "@/lib/clinical-model";
import "./secretary.css";
import { SecretaryNav, VisitOptions, VisitType } from "./clinic-ui";
import "./persisted.css";
import "@/app/doctor/workspace.css";
import {
  cancelUnavailableMessage,
  doctorAvailableMessage,
  doctorBusyMessage,
  doctorOccupiedMessage,
  handoffCancelMs,
} from "@/lib/queue-handoff";
import type {
  ClinicalOperations,
  ClinicalSnapshot,
} from "@/lib/clinical-types";

// Display only: the database enforces the same window and the doctor-opened rule.
function CancelHandoff({
  entry,
  disabled,
  onCancel,
}: {
  entry: { handedOffAt?: string; doctorOpened?: boolean };
  disabled?: boolean;
  onCancel: () => void;
}) {
  const remaining = () =>
    entry.handedOffAt
      ? Math.ceil(
          (Date.parse(entry.handedOffAt) + handoffCancelMs - Date.now()) / 1000
        )
      : 0;
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(remaining()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.handedOffAt]);
  if (entry.doctorOpened || seconds <= 0) return null;
  return (
    <button
      type="button"
      className="secretary-outline"
      disabled={disabled}
      onClick={onCancel}
    >
      إلغاء الإدخال ({seconds} ث)
    </button>
  );
}

export function ClinicFlowView({
  route,
  demo = false,
  local,
  clinical,
  operations,
  profile,
}: {
  route: string;
  demo?: boolean;
  local?: ReturnType<typeof useDemoClinic>;
  clinical?: ClinicalSnapshot;
  operations?: ClinicalOperations;
  profile?: AccountProfile | null;
}) {
  const { patients, queue } = clinical ?? local!;
  const update: ReturnType<typeof useDemoClinic>["update"] =
    local?.update ??
    (() => {
      throw new Error("Authenticated data requires a clinical operation");
    });
  const reset = local?.reset ?? (() => {});
  const router = useRouter();
  const params = useSearchParams();
  const href = (path: string) => `${demo ? "/demo" : ""}/${path}`;
  const [term, setTerm] = useState(params.get("q") ?? "");
  const [kind, setKind] = useState<QueueEntry["kind"]>("full_exam");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("نقص وزن");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PatientFieldErrors>({});
  const [patientRequestId, setPatientRequestId] = useState<string | null>(null);
  const selected = patients.find((p) => p.id === params.get("patient"));
  const visitKind = selected?.visits.length === 0 ? "full_exam" : kind;
  const entry = queue.find((e) => e.id === params.get("entry"));
  const patient = patients.find((p) => p.id === entry?.patientId);
  const go = (path: string) => router.push(href(path));
  const fileMatch = /^secretary\/patients\/([^/]+)(?:\/edit)?$/.exec(route);
  const filePatient =
    fileMatch && fileMatch[1] !== "new"
      ? patients.find((p) => p.id === fileMatch[1])
      : undefined;
  const queueToast = params.has("sent")
    ? "تم إدخال المريض عند الطبيب."
    : params.has("measured")
      ? "تم حفظ القياسات. المريض جاهز للدخول."
      : params.has("added")
        ? selected
          ? `أضيف ${selected.name} للدور · ${
              params.get("kind") === "full_exam" ? "كشفية" : "مراجعة"
            }`
          : "تمت إضافة المريض للدور."
        : "";
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
  const showResults = route !== "secretary/add" || !!normalize(term);
  const results = showResults ? matches : [];
  const findPatient = (e: QueueEntry) =>
    patients.find((p) => p.id === e.patientId)!;

  async function enqueue(id: string, visitKind: QueueEntry["kind"]) {
    if (operations) {
      if (await operations.enqueuePatient(id, visitKind))
        go(`secretary?added=1&patient=${id}&kind=${visitKind}`);
      return;
    }
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
    go(`secretary?added=1&patient=${id}&kind=${visitKind}`);
  }
  async function savePatient(next: Omit<PatientRecord, "visits">) {
    const backToFile = `secretary/patients/${next.id}`;
    if (operations) {
      const revision = clinical?.patients.find(
        (p) => p.id === next.id
      )?.revision;
      if (
        revision !== undefined &&
        (await operations.updatePatient(next, revision))
      )
        go(backToFile);
      return;
    }
    update((state) => ({
      ...state,
      patients: state.patients.map((p) =>
        p.id === next.id ? { ...p, ...next } : p
      ),
    }));
    go(backToFile);
  }
  async function createPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const { phone, height, birthYear, errors } = parsePatientFields(
      data,
      name,
      normalize
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    if (demo && patients.some((p) => p.phone === phone)) {
      setError("يوجد ملف بهذا الهاتف. اختر الملف الموجود من البحث.");
      return;
    }
    const id = patientRequestId ?? crypto.randomUUID();
    if (operations) setPatientRequestId(id);
    const record: PatientRecord = {
      id,
      name: name.trim(),
      phone,
      height,
      gender: String(data.get("gender")),
      birthYear,
      goal,
      visits: [],
    };
    if (operations) {
      if (await operations.createPatient(record)) {
        setPatientRequestId(null);
        go(`secretary/confirm?patient=${id}`);
      }
      return;
    }
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
        // Remount when the demo calendar settles after hydration, so history
        // seeded in useState does not keep the prerendered dates.
        key={`${entry.id}-${mode}-${local?.today ?? ""}`}
        mode={mode}
        patientName={patient.name}
        history={patient.visits}
        draft={entry.measurements}
        closeHref={href("secretary")}
        historyHref={href(`secretary/measurements/previous?entry=${entry.id}`)}
        pending={operations?.pending}
        revision={clinical?.queue.find((row) => row.id === entry.id)?.revision}
        readOnlyHistory={!!operations}
        onDraftChange={
          operations
            ? undefined
            : (measurements) =>
                update((state) => ({
                  ...state,
                  queue: state.queue.map((e) =>
                    e.id === entry.id
                      ? { ...e, measurements, status: "waiting" }
                      : e
                  ),
                }))
        }
        onHistoryChange={
          operations
            ? undefined
            : (visits) =>
                update((state) => ({
                  ...state,
                  patients: state.patients.map((p) =>
                    p.id === patient.id ? { ...p, visits } : p
                  ),
                }))
        }
        onComplete={async (measurements, revision) => {
          if (operations) {
            if (
              await operations.saveMeasurements(
                entry.id,
                measurements,
                revision
              )
            )
              go("secretary?measured=1");
            return;
          }
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
    return (
      <DoctorVisit
        entryId={route.split("/")[2]}
        demo={demo}
        clinical={clinical}
        operations={operations}
      />
    );

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
  const subheader = (title: string, back = "secretary", subtitle?: string) => (
    <header
      className={`secretary-subheader${doctor ? " doctor-record-header" : ""}`}
    >
      {doctor ? (
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      ) : (
        <h1>{title}</h1>
      )}
      <Link href={href(back)} aria-label="العودة">
        <Icon name={doctor ? "arrow" : "close"} />
      </Link>
    </header>
  );
  const badge = (e: QueueEntry) =>
    !demo ? (
      <VisitType kind={e.kind} />
    ) : (
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
          {error && (
            <p className="secretary-error" role="alert">
              {error}
            </p>
          )}
          {current[0] ? (
            <p className="intake-info" role="status">
              {doctorBusyMessage(findPatient(current[0]).name)}
            </p>
          ) : (
            completed.length > 0 && (
              <p className="intake-info" role="status">
                {doctorAvailableMessage}
              </p>
            )
          )}
          {queueToast && <Toast key={queueToast} message={queueToast} />}
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
                          {e.arrivalTime && (
                            <>
                              {findPatient(e).gender === "female"
                                ? "وصلت"
                                : "وصل"}{" "}
                              <bdi>{e.arrivalTime}</bdi> ·{" "}
                            </>
                          )}
                          الزيارة {findPatient(e).visits.length + 1}
                        </span>
                        {e.status === "waiting" &&
                          Object.keys(e.measurements).length > 0 && (
                            <span>القياسات غير مكتملة</span>
                          )}
                      </div>
                      {badge(e)}
                    </div>
                    <div className="queue-card-actions">
                      {e.status === "ready" ? (
                        <>
                          <button
                            className="secretary-primary"
                            disabled={operations?.pending}
                            onClick={async () => {
                              setError("");
                              // The server decides: this snapshot can be up to
                              // ten seconds behind a visit that just finished.
                              if (operations) {
                                if (await operations.handoffToDoctor(e.id))
                                  go("secretary?sent=1");
                                return;
                              }
                              if (local!.handoff(e.id) === "occupied")
                                setError(
                                  current[0]
                                    ? doctorBusyMessage(
                                        findPatient(current[0]).name
                                      )
                                    : doctorOccupiedMessage
                                );
                              else go("secretary?sent=1");
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
                    <CancelHandoff
                      entry={e}
                      disabled={operations?.pending}
                      onCancel={async () => {
                        setError("");
                        if (operations) {
                          await operations.cancelHandoff(e.id);
                          return;
                        }
                        if (!local!.cancelHandoff(e.id))
                          setError(cancelUnavailableMessage);
                      }}
                    />
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
          <Link className="queue-fab" href={href("secretary/add")}>
            <Icon name="plus" size={20} />
            إضافة للدور
          </Link>
        )}
      </>
    );
  else if (
    route === "secretary/add" ||
    route === "secretary/search" ||
    route === "secretary/patients"
  )
    content = (
      <>
        {subheader(
          route.endsWith("add")
            ? "إضافة للدور"
            : route.endsWith("search")
              ? "البحث"
              : "المرضى"
        )}
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
              onChange={(e) => {
                setTerm(e.target.value);
                operations?.search(e.target.value);
              }}
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
      </>
    );
  else if (route === "secretary/confirm")
    content = (
      <>
        {subheader("إضافة للدور", "secretary/add")}
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
                  {!demo ? (
                    <VisitOptions
                      kind={visitKind}
                      onChange={setKind}
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
                {queue.some((e) => e.patientId === selected.id) ? (
                  <Link className="secretary-primary" href={href("secretary")}>
                    العودة للدور
                  </Link>
                ) : (
                  <button
                    className="secretary-primary"
                    disabled={operations?.pending}
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
  else if (filePatient && route.endsWith("/edit"))
    content = (
      <>
        {subheader("تعديل البيانات", `secretary/patients/${filePatient.id}`)}
        <PatientEditForm
          patient={filePatient}
          backHref={href(`secretary/patients/${filePatient.id}`)}
          normalize={normalize}
          pending={operations?.pending}
          onSave={savePatient}
        />
      </>
    );
  else if (filePatient)
    content = (
      <PatientFile
        patient={filePatient}
        backHref={href("secretary/patients")}
        addHref={href(`secretary/confirm?patient=${filePatient.id}`)}
        editHref={href(`secretary/patients/${filePatient.id}/edit`)}
      />
    );
  else if (route === "secretary/patients/new")
    content = (
      <>
        {subheader("ملف مريض جديد", "secretary/add")}
        <form
          className="secretary-content new-patient-form"
          onSubmit={createPatient}
          noValidate
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
              aria-invalid={!!fieldErrors.name}
            />
            <FieldError message={fieldErrors.name} />
          </label>
          {name.trim().length > 1 &&
            patients.some((p) => p.name.includes(name.trim())) && (
              <div className="similar-patient">
                <strong>يوجد مريض باسم مشابه</strong>
                <p>هل هو نفس الشخص؟ أضفه للدور بدل فتح ملف جديد.</p>
                <Link
                  href={href(
                    `secretary/add?q=${encodeURIComponent(name.trim())}`
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
              aria-invalid={!!fieldErrors.phone}
            />
            <FieldError message={fieldErrors.phone} />
          </label>
          <div className="intake-two-columns">
            <label className="secretary-field">
              الطول *
              <input
                name="height"
                inputMode="decimal"
                required
                placeholder="مثال: 165 سم"
                aria-invalid={!!fieldErrors.height}
              />
              <FieldError message={fieldErrors.height} />
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
              placeholder="اختياري"
              aria-invalid={!!fieldErrors.birthYear}
            />
            <FieldError message={fieldErrors.birthYear} />
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
            <button
              className="secretary-primary"
              type="submit"
              disabled={operations?.pending}
            >
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
      <SecretaryAccount
        profile={profile}
        demoActions={
          demo ? (
            <>
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
              <DemoNote demo={demo} href={href("doctor")} />
            </>
          ) : undefined
        }
      />
    );
  else if (route === "doctor")
    content = (
      <DoctorHome
        demo={demo}
        current={current}
        waiting={waiting}
        completed={completed}
        findPatient={findPatient}
        href={href}
        agendaState={demo ? local : undefined}
        demoToday={local?.today}
      >
        <DemoNote demo={demo} href={href("secretary")} secretary />
      </DoctorHome>
    );
  else if (route === "doctor/week")
    content = (
      <>
        {subheader("مرضى هذا الأسبوع", "doctor")}
        <DoctorWeek
          demoState={demo ? local : undefined}
          demoToday={local?.today}
          href={href}
        />
      </>
    );
  else if (route === "doctor/patients" || route === "doctor/search")
    content = (
      <DoctorPatientList
        title={route === "doctor/search" ? "البحث" : "المرضى"}
        patients={matches}
        term={term}
        onTerm={(value) => {
          setTerm(value);
          operations?.search(value);
        }}
        href={href}
      />
    );
  else {
    const record = patients.find((p) => p.id === route.split("/")[2]);
    const today = queue.find((e) => e.patientId === record?.id);
    content = (
      <>
        {subheader(
          record?.name ?? "الملف غير موجود",
          "doctor",
          record ? `الهدف: ${record.goal}` : undefined
        )}
        <div className="secretary-content demo-patient-file">
          {record ? (
            <DoctorPatientRecord
              patient={record}
              today={today}
              demo={demo}
              currentYear={
                demo
                  ? Number(local!.today.slice(0, 4))
                  : new Date().getFullYear()
              }
              href={href}
              visitHref={
                demo ? undefined : (visit) => href(`doctor/visits/${visit.id}`)
              }
            />
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
    [
      "secretary",
      "secretary/patients",
      "secretary/account",
      "secretary/search",
    ].includes(route) || doctor;
  return (
    <main
      className={doctor ? "doctor-shell doctor-workspace" : "secretary-shell"}
      dir="rtl"
    >
      <fieldset
        disabled={operations?.pending}
        className={
          showNav
            ? doctor
              ? "doctor-scroll clinical-fieldset"
              : "secretary-scroll clinical-fieldset"
            : "intake-scroll clinical-fieldset"
        }
      >
        {content}
      </fieldset>
      {showNav && doctor ? (
        <DoctorNav route={route} demo={demo} />
      ) : showNav && !demo ? (
        <SecretaryNav route={route} />
      ) : (
        showNav && (
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
                    name={
                      item.id as "queue" | "patients" | "search" | "account"
                    }
                  />
                </span>
                {item.label}
              </Link>
            ))}
          </nav>
        )
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
  if (!demo) return null;
  return (
    <p className="demo-flow-note">
      عرض تجريبي · بيانات خيالية في هذا المتصفح فقط.
      {demo && (
        <Link href={href}>{secretary ? "عرض السكرتيرة" : "عرض الطبيب"}</Link>
      )}
    </p>
  );
}
