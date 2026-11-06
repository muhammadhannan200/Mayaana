"use client";

import type { ReactNode } from "react";
import type { useDemoClinic } from "@/frontend/demo/demo-clinic";
import { DemoNote } from "@/frontend/secretary/clinic-ui";
import type { clinicNotifications } from "@/shared/clinic-notifications";
import type { PatientRecord, QueueEntry } from "@/shared/clinical-model";
import { DoctorHome } from "./doctor-home";
import { DoctorWeek } from "./doctor-week";
import { DoctorPatientList } from "./patient-list";
import { DoctorPatientRecord, PatientMenu } from "./patient-record";

// The doctor's demo routes rendered inside the shared clinic flow.
export function DoctorRoute({
  route,
  demo,
  local,
  patients,
  queue,
  matches,
  term,
  onTerm,
  current,
  waiting,
  completed,
  findPatient,
  href,
  doctorName,
  notifications,
  subheader,
}: {
  route: string;
  demo: boolean;
  local?: ReturnType<typeof useDemoClinic>;
  patients: PatientRecord[];
  queue: QueueEntry[];
  matches: PatientRecord[];
  term: string;
  onTerm: (value: string) => void;
  current: QueueEntry[];
  waiting: QueueEntry[];
  completed: QueueEntry[];
  findPatient: (entry: QueueEntry) => PatientRecord;
  href: (path: string) => string;
  doctorName?: string;
  notifications: ReturnType<typeof clinicNotifications>;
  subheader: (
    title: string,
    back?: string,
    subtitle?: string,
    menu?: ReactNode
  ) => ReactNode;
}) {
  if (route === "doctor")
    return (
      <DoctorHome
        demo={demo}
        current={current}
        waiting={waiting}
        completed={completed}
        findPatient={findPatient}
        href={href}
        agendaState={demo ? local : undefined}
        demoToday={local?.today}
        doctorName={doctorName}
        notifications={notifications}
      >
        <DemoNote demo={demo} href={href("secretary")} secretary />
      </DoctorHome>
    );
  if (route === "doctor/week")
    return (
      <>
        {subheader("مرضى هذا الأسبوع", "doctor")}
        <DoctorWeek
          demoState={demo ? local : undefined}
          demoToday={local?.today}
          href={href}
        />
      </>
    );
  if (route === "doctor/patients" || route === "doctor/search")
    return (
      <DoctorPatientList
        title={route === "doctor/search" ? "البحث" : "المرضى"}
        patients={matches}
        term={term}
        onTerm={onTerm}
        href={href}
      />
    );
  const record = patients.find((p) => p.id === route.split("/")[2]);
  const today = queue.find((e) => e.patientId === record?.id);
  return (
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
              demo ? Number(local!.today.slice(0, 4)) : new Date().getFullYear()
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
