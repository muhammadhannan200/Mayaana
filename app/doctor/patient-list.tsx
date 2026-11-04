"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import type { PatientRecord } from "@/lib/clinical-model";

const filters = [
  { id: "all", label: "الكل", goal: "" },
  { id: "loss", label: "إنقاص وزن", goal: "نقص وزن" },
  { id: "gain", label: "زيادة وزن", goal: "زيادة وزن" },
] as const;

function weightChange(patient: PatientRecord) {
  const latest = patient.visits[0]?.measurements.weight;
  const first = patient.visits.at(-1)?.measurements.weight;
  return patient.visits.length > 1 && latest && first
    ? Number(latest) - Number(first)
    : null;
}

export function DoctorPatientList({
  title,
  patients,
  term,
  onTerm,
  href,
}: {
  title: string;
  patients: PatientRecord[];
  term: string;
  onTerm: (term: string) => void;
  href: (route: string) => string;
}) {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const goal = filters.find((item) => item.id === filter)?.goal;
  const shown = goal ? patients.filter((p) => p.goal === goal) : patients;
  return (
    <>
      <header className="doctor-list-header">
        <h1>{title}</h1>
        <p>إجمالي المرضى ({patients.length})</p>
      </header>
      <div className="secretary-content search-content doctor-patient-list">
        <label className="patient-search-input">
          <Icon name="search" size={20} />
          <input
            aria-label="اسم المريض أو رقم هاتفه"
            placeholder="ابحث بالاسم أو رقم الهاتف"
            value={term}
            onChange={(event) => onTerm(event.target.value)}
            maxLength={80}
          />
        </label>
        <div className="doctor-patient-filters" role="group" aria-label="الهدف">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label} (
              {item.goal
                ? patients.filter((p) => p.goal === item.goal).length
                : patients.length}
              )
            </button>
          ))}
        </div>
        <ul className="patient-result-list">
          {shown.map((p) => {
            const change = weightChange(p);
            return (
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
                  {change !== null && (
                    <span className="doctor-patient-change">
                      <bdi>
                        {change > 0 ? "+" : ""}
                        {change.toFixed(1)} كغ
                      </bdi>
                    </span>
                  )}
                  <Icon name="arrow" size={18} />
                </Link>
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && (
          <p className="secretary-muted">
            لا توجد نتائج. جرّب اسماً أو رقماً آخر.
          </p>
        )}
      </div>
    </>
  );
}
