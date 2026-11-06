"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { useDemoClinic } from "@/frontend/demo/demo-clinic";
import { clinicNotifications } from "@/shared/clinic-notifications";
import type { AccountProfile } from "@/backend/account-profile";
import { DemoResetActions, SecretaryAccount } from "./account-screen";
import { ConfirmQueueScreen } from "./confirm-queue-screen";
import { QueueScreen, queueToastText } from "./queue-screen";
import { NewPatientScreen } from "./new-patient-screen";
import { PatientSearchScreen } from "./patient-search-screen";
import { PatientEditForm } from "./patient-edit-form";
import { PatientFile } from "./patient-file";
import { normalize, usePatientActions } from "./use-patient-actions";
import { DoctorRoute } from "@/frontend/doctor/doctor-route";
import { DoctorNav } from "@/frontend/doctor/doctor-nav";
import { MeasurementRoute } from "./measurements/measurement-route";
import { DoctorVisit } from "@/frontend/doctor/visit-screen";
import type { QueueEntry } from "@/shared/clinical-model";
import "./secretary.css";
import { SecretaryNav, VisitType } from "./clinic-ui";
import { DemoNav, FlowSubheader } from "./flow-chrome";
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
  const [error, setError] = useState("");
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
  const queueToast = queueToastText(params, selected?.name);
  const waiting = queue.filter(
    (e) => e.status === "waiting" || e.status === "ready"
  );
  const current = queue.filter((e) => e.status === "with_doctor");
  const completed = queue.filter((e) => e.status === "completed");
  const matches = patients.filter((p) =>
    `${p.name} ${p.phone}`.includes(normalize(term))
  );
  const showResults = route !== "secretary/add" || !!normalize(term);
  const results = showResults ? matches : [];
  const {
    name,
    setName,
    goal,
    setGoal,
    fieldErrors,
    enqueue,
    savePatient,
    createPatient,
  } = usePatientActions({
    demo,
    patients,
    clinical,
    operations,
    update,
    go,
    setError,
  });
  const findPatient = (e: QueueEntry) =>
    patients.find((p) => p.id === e.patientId)!;

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
  const subheader = (
    title: string,
    back = "secretary",
    subtitle?: string,
    menu?: ReactNode
  ) => (
    <FlowSubheader
      doctor={doctor}
      title={title}
      backHref={href(back)}
      subtitle={subtitle}
      menu={menu}
    />
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
            <DemoResetActions
              onReset={() => {
                reset();
                go("secretary");
              }}
              doctorHref={href("doctor")}
            />
          ) : undefined
        }
      />
    );
  else
    content = (
      <DoctorRoute
        route={route}
        demo={demo}
        local={local}
        patients={patients}
        queue={queue}
        matches={matches}
        term={term}
        onTerm={(value) => {
          setTerm(value);
          operations?.search(value);
        }}
        current={current}
        waiting={waiting}
        completed={completed}
        findPatient={findPatient}
        href={href}
        doctorName={profile?.name}
        notifications={notifications}
        subheader={subheader}
      />
    );
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
        showNav && <DemoNav route={route} href={href} />
      )}
    </main>
  );
}
