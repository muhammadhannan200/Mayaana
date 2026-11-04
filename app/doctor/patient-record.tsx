"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { arabicVisitSummary } from "@/lib/arabic-count";
import {
  measurementFields,
  type PatientRecord as Patient,
  type QueueEntry,
  type VisitHistoryItem,
} from "@/lib/clinical-model";
import { PatientProgress, PatientVisits } from "./patient-progress";
import "./patient-record.css";

const tabs = [
  { id: "file", label: "الملف" },
  { id: "progress", label: "التطور" },
  { id: "visits", label: "الزيارات" },
] as const;

export function DoctorPatientRecord({
  patient,
  today,
  demo,
  currentYear,
  href,
  visitHref,
}: {
  patient: Patient;
  today?: QueueEntry;
  demo: boolean;
  currentYear: number;
  href: (route: string) => string;
  visitHref?: (visit: VisitHistoryItem) => string;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("file");
  const latest =
    today && today.status !== "waiting"
      ? today.measurements
      : patient.visits[0]?.measurements;
  const startingWeight = patient.visits.at(-1)?.measurements.weight;
  const change =
    latest?.weight && startingWeight
      ? Number(latest.weight) - Number(startingWeight)
      : null;
  return (
    <>
      <div className="record-tabs" role="tablist" aria-label="ملف المريض">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "progress" && <PatientProgress patient={patient} />}
      {tab === "visits" && (
        <PatientVisits patient={patient} visitHref={visitHref} />
      )}
      {tab === "file" && (
        <>
          {latest?.weight && (
            <section className="patient-progress">
              <h2>
                <Image
                  src="/rashaqa/doctor-target.svg"
                  width={18}
                  height={18}
                  alt=""
                  unoptimized
                />
                التقدم منذ البداية
              </h2>
              <p>
                {startingWeight && (
                  <small>
                    من <bdi>{startingWeight}</bdi>
                  </small>
                )}
                <strong>
                  <bdi>{latest.weight}</bdi>
                </strong>
                <span>كغ</span>
              </p>
              {change !== null && (
                <span>{arabicVisitSummary(change, patient.visits.length)}</span>
              )}
            </section>
          )}
          <section>
            <h2>معلومات المريض</h2>
            <dl className="demo-patient-info">
              <div>
                <dt>الهدف</dt>
                <dd>{patient.goal}</dd>
              </div>
              <div>
                <dt>الطول</dt>
                <dd>{patient.height} سم</dd>
              </div>
              {patient.birthYear && (
                <div>
                  <dt>العمر التقريبي</dt>
                  <dd>{currentYear - Number(patient.birthYear)} سنة</dd>
                </div>
              )}
              <div>
                <dt>{demo ? "الهاتف التجريبي" : "الهاتف"}</dt>
                <dd>
                  <bdi>{patient.phone}</bdi>
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
          <section className="doctor-record-section">
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
                          {today.measurements[f.key]} <small>{f.unit}</small>
                        </bdi>
                      </dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p>لم تُستكمل قياسات اليوم بعد.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
