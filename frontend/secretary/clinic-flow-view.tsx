"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { useDemoClinic } from "@/frontend/demo/demo-clinic";
import { Icon } from "@/frontend/components/icon";
import { clinicNotifications } from "@/shared/clinic-notifications";
import type { AccountProfile } from "@/backend/account-profile";
import {
  parsePatientFields,
  type PatientFieldErrors,
} from "@/shared/patient-validation";
import { SecretaryAccount } from "./account-screen";
import { ConfirmQueueScreen } from "./confirm-queue-screen";
import { QueueScreen } from "./queue-screen";
import { NewPatientScreen } from "./new-patient-screen";
import { PatientSearchScreen } from "./patient-search-screen";
import { PatientEditForm } from "./patient-edit-form";
import { PatientFile } from "./patient-file";
import { DoctorNav } from "@/frontend/doctor/doctor-nav";
import { MeasurementRoute } from "./measurements/measurement-route";
import { DoctorVisit } from "@/frontend/doctor/visit-screen";
import { DoctorHome } from "@/frontend/doctor/doctor-home";
import { DoctorWeek } from "@/frontend/doctor/doctor-week";
import { DoctorPatientList } from "@/frontend/doctor/patient-list";
import {
  DoctorPatientRecord,
  PatientMenu,
} from "@/frontend/doctor/patient-record";
import { type PatientRecord, type QueueEntry } from "@/shared/clinical-model";
import "./secretary.css";
import { DemoNote, SecretaryNav, VisitType } from "./clinic-ui";
import "./persisted.css";
import "@/frontend/doctor/workspace.css";
import type {
  ClinicalOperations,
  ClinicalSnapshot,
} from "@/shared/clinical-types";

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
  const notifications = clinicNotifications(
    route.startsWith("doctor") ? "doctor" : "secretary",
    queue,
    (entry) =>
      patients.find((item) => item.id === entry.patientId)?.name ?? "مريض"
  );
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

  if (route.includes("/measurements/"))
    return (
      <MeasurementRoute
        route={route}
        entry={entry}
        patient={patient}
        local={local}
        clinical={clinical}
        operations={operations}
        href={href}
        go={go}
      />
    );

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
  const subheader = (
    title: string,
    back = "secretary",
    subtitle?: string,
    menu?: ReactNode
  ) => (
    <header
      className={`secretary-subheader${doctor ? " doctor-record-header" : ""}`}
    >
      {menu}
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
      <QueueScreen
        demo={demo}
        queue={queue}
        waiting={waiting}
        current={current}
        completed={completed}
        notifications={notifications}
        queueToast={queueToast}
        error={error}
        setError={setError}
        operations={operations}
        local={local}
        href={href}
        go={go}
        findPatient={findPatient}
        badge={badge}
      />
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
        <PatientSearchScreen
          route={route}
          term={term}
          onTerm={(value) => {
            setTerm(value);
            operations?.search(value);
          }}
          showResults={showResults}
          results={results}
          href={href}
        />
      </>
    );
  else if (route === "secretary/confirm")
    content = (
      <>
        {subheader("إضافة للدور", "secretary/add")}
        <ConfirmQueueScreen
          selected={selected}
          queued={queue.some((e) => e.patientId === selected?.id)}
          demo={demo}
          kind={kind}
          visitKind={visitKind}
          onKind={setKind}
          pending={operations?.pending}
          href={href}
          onEnqueue={enqueue}
        />
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
        <NewPatientScreen
          name={name}
          onName={setName}
          goal={goal}
          onGoal={setGoal}
          error={error}
          fieldErrors={fieldErrors}
          patients={patients}
          pending={operations?.pending}
          href={href}
          onSubmit={createPatient}
        />
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
        doctorName={profile?.name}
        notifications={notifications}
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
          record ? `الهدف: ${record.goal}` : undefined,
          record && <PatientMenu phone={record.phone} />
        )}
        <div className="secretary-content demo-patient-file">
          {record ? (
            <DoctorPatientRecord
              patient={record}
              today={today}
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
    ].includes(route) ||
    (doctor && !/^doctor\/patients\/[^/]+$/.test(route));
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
