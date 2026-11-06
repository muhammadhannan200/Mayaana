"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/frontend/components/icon";
import type { PatientRecord } from "@/shared/clinical-model";
import {
  PreviousSheet,
  PreviousVisitCard,
} from "./measurements/previous-visit";
import "./patient-file.css";
import { displayDate } from "@/shared/clinic-dates";

export function PatientFile({
  patient,
  backHref,
  addHref,
  editHref,
}: {
  patient: PatientRecord;
  backHref: string;
  addHref: string;
  editHref: string;
}) {
  const [openVisit, setOpenVisit] = useState<string | null>(null);
  const last = patient.visits[0];
  const active = patient.visits.find((visit) => visit.id === openVisit);
  const rows = [
    { label: "الهاتف", value: <bdi dir="ltr">{patient.phone}</bdi> },
    { label: "الطول", value: patient.height ? `${patient.height} سم` : "—" },
    {
      label: "آخر زيارة",
      value: last
        ? `${displayDate(last.date)} · ${last.kind === "full_exam" ? "كشفية" : "مراجعة"}`
        : "لا توجد زيارات",
    },
    { label: "الزيارة القادمة", value: `رقم ${patient.visits.length + 1}` },
  ];
  return (
    <>
      <header className="patient-file-header">
        <div>
          <h1>{patient.name}</h1>
          {patient.goal && <p>الهدف: {patient.goal}</p>}
        </div>
        <Link href={backHref} aria-label="العودة">
          <Icon name="arrow" />
        </Link>
      </header>
      <div className="patient-file">
        <dl className="patient-file-card">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <section className="patient-file-visits">
          <h2>الأوزان المسجّلة</h2>
          {patient.visits.length ? (
            <>
              <p>اضغط على أي زيارة لعرض قياساتها.</p>
              <div className="measure-visit-list">
                {patient.visits.map((visit, index) => (
                  <PreviousVisitCard
                    key={visit.id}
                    visit={visit}
                    expanded
                    previousWeight={
                      patient.visits[index + 1]?.measurements.weight
                    }
                    onOpen={() => setOpenVisit(visit.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p>لا توجد زيارات مسجّلة بعد.</p>
          )}
        </section>
        <p className="patient-file-note">
          <Icon name="lock" size={16} />
          ملاحظات الطبيب والبرامج الغذائية لا تظهر في حسابك.
        </p>
      </div>
      <div className="intake-actionbar patient-file-actions">
        <Link className="secretary-primary" href={addHref}>
          <Icon name="plus" size={20} />
          إضافة للدور
        </Link>
        <Link className="secretary-outline" href={editHref}>
          <Icon name="edit" size={18} />
          تعديل البيانات
        </Link>
      </div>
      {active && (
        <PreviousSheet
          visit={active}
          readOnly
          onClose={() => setOpenVisit(null)}
          onSave={() => setOpenVisit(null)}
        />
      )}
    </>
  );
}
