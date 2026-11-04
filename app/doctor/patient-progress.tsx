"use client";

import Link from "next/link";
import { useState } from "react";
import { VisitType } from "@/app/secretary/clinic-ui";
import type {
  MeasurementKey,
  PatientRecord,
  QueueEntry,
  VisitHistoryItem,
} from "@/lib/clinical-model";

const metrics: { key: MeasurementKey; label: string; unit: string }[] = [
  { key: "weight", label: "الوزن", unit: "كغ" },
  { key: "fat", label: "الدهون", unit: "%" },
  { key: "waist", label: "المحيطات", unit: "سم" },
];
const comparisonRows: { key: MeasurementKey; label: string }[] = [
  { key: "weight", label: "الوزن" },
  { key: "fat", label: "الدهون %" },
  { key: "muscle", label: "العضل كغ" },
  { key: "waist", label: "الخصر سم" },
  { key: "hip", label: "الورك سم" },
];
const width = 320;
const height = 150;
const pad = 28;

function chartPoints(values: { value: number; date: string }[]) {
  const numbers = values.map((item) => item.value);
  const min = Math.min(...numbers);
  const range = Math.max(...numbers) - min || 1;
  return values.map((item, index) => ({
    ...item,
    // Oldest visit on the right, matching the RTL reading direction.
    x:
      values.length === 1
        ? width / 2
        : width - pad - (index * (width - pad * 2)) / (values.length - 1),
    y: height - pad - ((item.value - min) / range) * (height - pad * 2),
  }));
}

function ProgressChart({
  values,
  title,
}: {
  values: { value: number; date: string }[];
  title: string;
}) {
  if (!values.length)
    return <p className="record-empty">لا توجد قياسات مسجّلة بعد.</p>;
  const points = chartPoints(values);
  return (
    <figure className="progress-chart">
      <figcaption>
        <strong>{title}</strong>
        <span>عدد الزيارات: {values.length}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height + 18}`}
        role="img"
        aria-label={`${title}: ${values
          .map((item) => `${item.date} ${item.value}`)
          .join("، ")}`}
      >
        {[0, 1, 2, 3].map((line) => (
          <line
            key={line}
            className="progress-grid"
            x1={pad / 2}
            x2={width - pad / 2}
            y1={pad + (line * (height - pad * 2)) / 3}
            y2={pad + (line * (height - pad * 2)) / 3}
          />
        ))}
        <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} />
        {points.map((point) => (
          <g key={`${point.date}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r="4" />
            <text x={point.x} y={point.y - 10}>
              {point.value}
            </text>
            <text className="progress-date" x={point.x} y={height + 12}>
              {point.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

function fullExamComparison(visits: VisitHistoryItem[]) {
  const exams = visits.filter((visit) => visit.kind === "full_exam");
  return exams.length ? { latest: exams[0], first: exams.at(-1)! } : null;
}

export function PatientProgress({ patient }: { patient: PatientRecord }) {
  const [metric, setMetric] = useState(metrics[0]);
  const values = patient.visits
    .filter((visit) => visit.measurements[metric.key])
    .map((visit) => ({
      value: Number(visit.measurements[metric.key]),
      date: visit.date,
    }))
    .reverse();
  const comparison = fullExamComparison(patient.visits);
  return (
    <div className="record-tab-content">
      <div className="progress-metrics" role="group" aria-label="نوع القياس">
        {metrics.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={item.key === metric.key}
            onClick={() => setMetric(item)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ProgressChart
        values={values}
        title={`${metric.label} (${metric.unit})`}
      />
      <section>
        <h2>مقارنة الكشفيات</h2>
        {comparison ? (
          <table className="progress-table">
            <thead>
              <tr>
                <th scope="col">القياس</th>
                {comparison.first !== comparison.latest && (
                  <th scope="col">{comparison.first.date}</th>
                )}
                <th scope="col">{comparison.latest.date}</th>
                <th scope="col">التغيّر</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(({ key, label }) => {
                const before = comparison.first.measurements[key];
                const after = comparison.latest.measurements[key];
                const change =
                  before && after && comparison.first !== comparison.latest
                    ? Number(after) - Number(before)
                    : null;
                return (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    {comparison.first !== comparison.latest && (
                      <td>{before ?? "—"}</td>
                    )}
                    <td>{after ?? "—"}</td>
                    <td>
                      {change === null ? (
                        "—"
                      ) : (
                        <bdi>
                          {change > 0 ? "+" : ""}
                          {change.toFixed(1)}
                        </bdi>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="record-empty">لا توجد كشفية مسجّلة بعد.</p>
        )}
      </section>
    </div>
  );
}

export function PatientVisits({
  patient,
  today,
  todayHref,
  visitHref,
}: {
  patient: PatientRecord;
  today?: QueueEntry;
  todayHref?: string;
  visitHref?: (visit: VisitHistoryItem) => string;
}) {
  if (!patient.visits.length && !today)
    return (
      <div className="record-tab-content">
        <p className="record-empty">لا توجد زيارات سابقة.</p>
      </div>
    );
  return (
    <ul className="record-tab-content record-visits demo-visit-history">
      {today && todayHref && (
        <li>
          <Link href={todayHref}>
            <div>
              <strong>زيارة اليوم</strong>
              <VisitType kind={today.kind} />
            </div>
            <p>
              {today.status === "completed" ? "اكتملت" : "عند الطبيب الآن"}
              {today.measurements.weight && (
                <>
                  {" · "}
                  <bdi>{today.measurements.weight} كغ</bdi>
                </>
              )}
            </p>
          </Link>
        </li>
      )}
      {patient.visits.map((visit, index) => {
        const previous = patient.visits[index + 1]?.measurements.weight;
        const change =
          previous && visit.measurements.weight
            ? Number(visit.measurements.weight) - Number(previous)
            : null;
        const body = (
          <>
            <div>
              <strong>الزيارة {visit.number}</strong>
              <VisitType kind={visit.kind} />
              {change !== null && (
                <span className={change > 0 ? "record-up" : "record-down"}>
                  <bdi>
                    {change > 0 ? "+" : ""}
                    {change.toFixed(1)} كغ
                  </bdi>
                </span>
              )}
            </div>
            <p>
              <bdi>{visit.date}</bdi> ·{" "}
              <bdi>{visit.measurements.weight} كغ</bdi>
            </p>
          </>
        );
        const link = visitHref?.(visit);
        return (
          <li key={visit.id}>
            {link ? <Link href={link}>{body}</Link> : body}
          </li>
        );
      })}
    </ul>
  );
}
