"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/frontend/components/icon";
import { arabicVisitSummary } from "@/shared/arabic-count";
import {
  type MeasurementKey,
  type PatientRecord as Patient,
  type QueueEntry,
  type VisitHistoryItem,
} from "@/shared/clinical-model";
import { whatsappUrl } from "@/shared/whatsapp";
import { PatientProgress, PatientVisits } from "./patient-progress";
import "./patient-record.css";
import { displayDate } from "@/shared/clinic-dates";

const tabs = [
  { id: "file", label: "الملف" },
  { id: "progress", label: "التطور" },
  { id: "visits", label: "الزيارات" },
] as const;

const examCards: { key: MeasurementKey; label: string; unit: string }[] = [
  { key: "muscle", label: "الكتلة العضلية", unit: "كغ" },
  { key: "fat", label: "نسبة الدهون", unit: "%" },
  { key: "waist", label: "الخصر", unit: "سم" },
  { key: "visceral", label: "الدهون الحشوية", unit: "مستوى" },
];

function LatestFullExam({
  patient,
  today,
}: {
  patient: Patient;
  today?: QueueEntry;
}) {
  const exams = [
    ...(today?.kind === "full_exam" && today.status !== "waiting"
      ? [today.measurements]
      : []),
    ...patient.visits
      .filter((visit) => visit.kind === "full_exam")
      .map((visit) => visit.measurements),
  ];
  const [latest, previous] = exams;
  if (!latest) return null;
  return (
    <section>
      <h2>آخر قياس كامل</h2>
      <div className="record-exam">
        {examCards.map(({ key, label, unit }) => {
          const change =
            previous?.[key] && latest[key]
              ? Number(latest[key]) - Number(previous[key])
              : null;
          return (
            <div key={key}>
              <span>{label}</span>
              {change !== null && (
                <small>
                  <bdi dir="ltr">
                    {change > 0 ? "+" : ""}
                    {change.toFixed(1)}
                  </bdi>
                </small>
              )}
              <strong>
                <bdi>
                  {latest[key] ?? "—"} <small>{unit}</small>
                </bdi>
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function PatientMenu({ phone }: { phone: string }) {
  const whatsapp = whatsappUrl(phone, "");
  return (
    <details className="record-menu">
      <summary aria-label="خيارات المريض">
        <Icon name="dots" size={20} />
      </summary>
      <div>
        <a href={`tel:${phone}`}>اتصال بالمريض</a>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            واتساب
          </a>
        )}
      </div>
    </details>
  );
}

export function DoctorPatientRecord({
  patient,
  today,
  currentYear,
  href,
  visitHref,
}: {
  patient: Patient;
  today?: QueueEntry;
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
  const firstVisit = patient.visits.at(-1);
  const fullExams = patient.visits.filter(
    (visit) => visit.kind === "full_exam"
  ).length;
  const activeToday =
    today?.status === "with_doctor" || today?.status === "completed"
      ? today
      : undefined;
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
        <PatientVisits
          patient={patient}
          today={activeToday}
          todayHref={activeToday && href(`doctor/visits/${activeToday.id}`)}
          visitHref={visitHref}
        />
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
          <LatestFullExam patient={patient} today={today} />
          <section>
            <h2>معلومات المريض</h2>
            <dl className="demo-patient-info">
              <div>
                <dt>الطول</dt>
                <dd>{patient.height} سم</dd>
              </div>
              {patient.birthYear && (
                <div>
                  <dt>العمر</dt>
                  <dd>{currentYear - Number(patient.birthYear)} سنة</dd>
                </div>
              )}
              {firstVisit && (
                <div>
                  <dt>أول زيارة</dt>
                  <dd>
                    <bdi>{displayDate(firstVisit.date)}</bdi>
                  </dd>
                </div>
              )}
              <div>
                <dt>عدد الزيارات</dt>
                <dd>
                  {patient.visits.length}
                  {patient.visits.length > 0 &&
                    ` (${fullExams} كشفية · ${patient.visits.length - fullExams} مراجعة)`}
                </dd>
              </div>
            </dl>
          </section>
        </>
      )}
      {activeToday && (
        <div className="record-cta">
          <Link
            className="secretary-primary"
            href={href(`doctor/visits/${activeToday.id}`)}
          >
            {activeToday.status === "completed"
              ? "عرض الزيارة المكتملة"
              : "فتح زيارة اليوم"}
          </Link>
        </div>
      )}
    </>
  );
}
