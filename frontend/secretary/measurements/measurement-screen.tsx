"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/frontend/components/icon";
import {
  measurementFields,
  type MeasurementKey,
  type VisitMeasurement,
} from "@/shared/clinical-model";
import {
  normalizeMeasurement,
  validateMeasurement,
} from "@/shared/measurement-validation";
import {
  followUpFixture,
  fullExamFixture,
  type MockVisit,
} from "./mock-visits";
import { NumericField, TopBar, WeightDelta } from "./measurement-parts";
import { PreviousSheet, PreviousVisitCard } from "./previous-visit";
import "./measurements.css";
import { displayDate } from "@/shared/clinic-dates";

type Mode = "follow-up" | "full-exam" | "previous";

export function MeasurementScreen({
  mode,
  preview = false,
  patientName,
  history,
  draft,
  closeHref,
  historyHref,
  onDraftChange,
  onHistoryChange,
  onComplete,
  pending = false,
  revision,
  readOnlyHistory = false,
}: {
  mode: Mode;
  preview?: boolean;
  patientName?: string;
  history?: MockVisit[];
  draft?: VisitMeasurement;
  closeHref?: string;
  historyHref?: string;
  onDraftChange?: (measurements: VisitMeasurement) => void;
  onHistoryChange?: (visits: MockVisit[]) => void;
  onComplete?: (measurements: VisitMeasurement, revision?: number) => void;
  pending?: boolean;
  revision?: number;
  readOnlyHistory?: boolean;
}) {
  const full = mode === "full-exam";
  const [expectedRevision] = useState(revision);
  const expanded = mode === "previous";
  const [visits, setVisits] = useState<MockVisit[]>(
    history ?? followUpFixture.visits
  );
  const [selected, setSelected] = useState<string | null>(
    expanded ? ((history ?? followUpFixture.visits)[1]?.id ?? null) : null
  );
  const [weight, setWeight] = useState(
    draft
      ? (draft.weight ?? "")
      : full
        ? (fullExamFixture.current.weight ?? "")
        : followUpFixture.currentWeight
  );
  const [values, setValues] = useState<VisitMeasurement>({
    ...(draft ?? fullExamFixture.current),
  });
  const [errors, setErrors] = useState<Partial<Record<MeasurementKey, string>>>(
    {}
  );
  const [saved, setSaved] = useState(false);
  const activeVisit = visits.find((visit) => visit.id === selected);
  const validWeight = validateMeasurement(weight, "weight") === null;
  const currentWeight = Number(normalizeMeasurement(weight));
  const lastWeight = Number(visits[0]?.measurements.weight ?? weight);
  const firstWeight = Number(
    visits[visits.length - 1]?.measurements.weight ?? weight
  );
  const delta = currentWeight - lastWeight;
  const previousHref =
    historyHref ??
    `${preview ? "/measurement-preview" : "/secretary/measurements"}/previous`;

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Partial<Record<MeasurementKey, string>> = {};
    const fields = full ? measurementFields : measurementFields.slice(0, 1);
    for (const field of fields) {
      const error = validateMeasurement(
        full ? (values[field.key] ?? "") : (weight ?? ""),
        field.key
      );
      if (error) nextErrors[field.key] = error;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const form = event.currentTarget;
      requestAnimationFrame(() =>
        form.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
      );
    }
    if (!Object.keys(nextErrors).length) {
      if (onComplete) {
        const measurements = full ? values : { weight };
        onComplete(
          Object.fromEntries(
            Object.entries(measurements).map(([key, value]) => [
              key,
              normalizeMeasurement(value),
            ])
          ),
          expectedRevision
        );
      } else setSaved(true);
    }
  }

  return (
    <main className="measure-shell" dir="rtl">
      <TopBar
        closeHref={
          closeHref ?? (preview ? "/measurement-preview" : "/secretary")
        }
        title={full ? "قياس كامل" : "قياس الوزن"}
        subtitle={
          patientName
            ? `${patientName} · ${full ? "كشفية" : "مراجعة"} · الزيارة ${(history?.length ?? 0) + 1}`
            : full
              ? `${fullExamFixture.patientName} · كشفية · الزيارة ${fullExamFixture.visitNumber}`
              : expanded
                ? `${followUpFixture.patientName} · مراجعة · الزيارة ${followUpFixture.visitNumber} · الهدف: ${followUpFixture.goal}`
                : undefined
        }
      />
      <form className="measure-form" onSubmit={submit} noValidate>
        <fieldset
          className="measure-content clinical-fieldset"
          disabled={pending}
        >
          {full ? (
            <>
              <p className="measure-tip">
                <Icon name="info" size={16} />
                انقل الأرقام من ورقة جهاز تحليل الجسم (InBody).
              </p>
              <section className="measure-fields-section">
                <h2>الوزن ومكونات الجسم</h2>
                <div className="measure-fields-grid">
                  {[
                    measurementFields[1],
                    measurementFields[0],
                    measurementFields[3],
                    measurementFields[2],
                    measurementFields[4],
                  ].map((field) => (
                    <NumericField
                      key={field.key}
                      field={field}
                      value={values[field.key] ?? ""}
                      previous={
                        onComplete
                          ? visits[0]?.measurements[field.key]
                          : fullExamFixture.previous[field.key]
                      }
                      error={errors[field.key]}
                      onChange={(value) => {
                        setValues((current) => ({
                          ...current,
                          [field.key]: value,
                        }));
                        onDraftChange?.({ ...values, [field.key]: value });
                        setSaved(false);
                      }}
                    />
                  ))}
                </div>
              </section>
              <section className="measure-fields-section">
                <h2>المحيطات (سم)</h2>
                <div className="measure-fields-grid">
                  {[
                    measurementFields[6],
                    measurementFields[5],
                    measurementFields[8],
                    measurementFields[7],
                  ].map((field) => (
                    <NumericField
                      key={field.key}
                      field={field}
                      value={values[field.key] ?? ""}
                      previous={
                        onComplete
                          ? visits[0]?.measurements[field.key]
                          : fullExamFixture.previous[field.key]
                      }
                      error={errors[field.key]}
                      onChange={(value) => {
                        setValues((current) => ({
                          ...current,
                          [field.key]: value,
                        }));
                        onDraftChange?.({ ...values, [field.key]: value });
                        setSaved(false);
                      }}
                    />
                  ))}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="measure-weight">
                <label htmlFor="today-weight">الوزن اليوم</label>
                <div className="measure-weight-value">
                  <input
                    id="today-weight"
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={weight}
                    onChange={(event) => {
                      setWeight(event.target.value);
                      onDraftChange?.({ weight: event.target.value });
                      setSaved(false);
                    }}
                    aria-invalid={!!errors.weight}
                    aria-describedby={
                      errors.weight ? "weight-error" : undefined
                    }
                  />
                  <span>كغ</span>
                </div>
                {errors.weight && (
                  <small id="weight-error" className="measure-field-error">
                    {errors.weight}
                  </small>
                )}
                {expanded && validWeight && (
                  <>
                    <div className="measure-weight-line" />
                    <div className="measure-weight-change">
                      <span>
                        عن آخر زيارة ·{" "}
                        {delta < 0
                          ? "ماشي نحو الهدف"
                          : delta > 0
                            ? "بعيد عن الهدف"
                            : "الوزن ثابت"}
                      </span>
                      <WeightDelta increase={delta > 0}>
                        {Math.abs(delta).toFixed(1)} كغ
                      </WeightDelta>
                    </div>
                  </>
                )}
              </section>
              {expanded && validWeight && (
                <section className="measure-journey">
                  <div>
                    <strong>رحلة الوزن</strong>
                    <span>
                      {currentWeight <= firstWeight ? "نزل" : "زاد"}{" "}
                      {Math.abs(firstWeight - currentWeight).toFixed(1)} كغ منذ
                      البداية
                    </span>
                  </div>
                  <div className="measure-journey-steps">
                    {[
                      { value: normalizeMeasurement(weight), date: "اليوم" },
                      ...visits.map((visit) => ({
                        value: visit.measurements.weight,
                        date: visit.date,
                      })),
                    ].map((item, index) => (
                      <div key={item.date}>
                        <strong dir="ltr">{item.value}</strong>
                        <span>{displayDate(item.date)}</span>
                        {index < visits.length && <i />}
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section className="measure-history">
                <h2>الزيارات السابقة ({visits.length})</h2>
                {expanded && (
                  <p>
                    {readOnlyHistory
                      ? "اضغط على أي زيارة لعرض قياساتها"
                      : "اضغط على أي زيارة لعرض قياساتها أو تعديلها"}
                  </p>
                )}
                <div className="measure-visit-list">
                  {visits.map((visit, index) => (
                    <PreviousVisitCard
                      key={visit.id}
                      visit={visit}
                      expanded={expanded}
                      previousWeight={visits[index + 1]?.measurements.weight}
                      onOpen={() => setSelected(visit.id)}
                    />
                  ))}
                </div>
              </section>
              {!expanded && (
                <Link className="measure-history-link" href={previousHref}>
                  عرض تفاصيل الزيارات السابقة <Icon name="arrow" size={16} />
                </Link>
              )}
            </>
          )}
          {saved && (
            <p className="measure-saved" role="status">
              تم التحقق من القياسات في العرض التجريبي فقط. لم تُرسل للطبيب ولم
              تُحفظ في قاعدة البيانات.
            </p>
          )}
          {!saved && !onComplete && (
            <p className="measure-demo-note">
              بيانات خيالية للمعاينة فقط — لا حفظ أو إرسال فعلي.
            </p>
          )}
        </fieldset>
        <footer className="measure-actionbar">
          <button type="submit" className="measure-primary" disabled={pending}>
            <Icon name="check" size={20} />
            {onComplete
              ? "حفظ القياسات وتجهيز للدخول"
              : "تحقّق من القياسات فقط"}
          </button>
        </footer>
      </form>
      {activeVisit && (
        <PreviousSheet
          key={activeVisit.id}
          shared={!!onHistoryChange}
          readOnly={readOnlyHistory}
          visit={activeVisit}
          onClose={() => setSelected(null)}
          onSave={(measurements) => {
            const next = visits.map((visit) =>
              visit.id === activeVisit.id ? { ...visit, measurements } : visit
            );
            setVisits(next);
            onHistoryChange?.(next);
          }}
        />
      )}
    </main>
  );
}
