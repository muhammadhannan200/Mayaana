"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../components";
import {
  followUpFixture,
  fullExamFixture,
  measurementFields,
  type MeasurementKey,
  type MockVisit,
  type VisitMeasurement,
} from "./mock-visits";
import "./measurements.css";

type Mode = "follow-up" | "full-exam" | "previous";

function normalize(value: string) {
  return value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٫,]/g, ".");
}

function validate(value: string, key: MeasurementKey): string | null {
  const normalized = normalize(value);
  const number = Number(normalized);
  const field = measurementFields.find((item) => item.key === key);
  if (
    !value.trim() ||
    !Number.isFinite(number) ||
    number <= 0 ||
    number > (field?.max ?? 500)
  )
    return `أدخل ${field?.label ?? "الوزن"} برقم أكبر من صفر ولا يتجاوز ${field?.max ?? 500}.`;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized))
    return "استخدم رقماً موجباً بدقة لا تزيد عن منزلتين عشريتين.";
  return null;
}

function TopBar({
  title,
  subtitle,
  closeHref,
}: {
  title: string;
  subtitle?: string;
  closeHref: string;
}) {
  return (
    <header className="measure-topbar">
      <Link
        className="measure-icon-button"
        href={closeHref}
        aria-label="إغلاق شاشة القياس"
      >
        <Icon name="close" size={20} />
      </Link>
      <div className="measure-topbar-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <span className="measure-topbar-spacer" aria-hidden="true" />
    </header>
  );
}

function VisitBadge({ kind }: { kind: MockVisit["kind"] }) {
  return (
    <span
      className={kind === "full_exam" ? "measure-badge exam" : "measure-badge"}
    >
      <Icon name={kind === "full_exam" ? "ruler" : "scale"} size={14} />
      {kind === "full_exam" ? "كشفية" : "مراجعة"}
    </span>
  );
}

function WeightDelta({
  children,
  increase = false,
}: {
  children: React.ReactNode;
  increase?: boolean;
}) {
  return (
    <span className={`measure-delta${increase ? " away" : ""}`}>
      <span className={increase ? "measure-up" : undefined}>
        <Icon name="down" size={14} />
      </span>
      {children}
    </span>
  );
}

function NumericField({
  field,
  value,
  previous,
  onChange,
  error,
}: {
  field: (typeof measurementFields)[number];
  value: string;
  previous?: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <label className="measure-field">
      <span>{field.label}</span>
      <span className="measure-input-wrap">
        <input
          type="text"
          inputMode="decimal"
          dir="ltr"
          aria-label={field.label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${field.key}-error` : undefined}
        />
        <span>{field.unit}</span>
      </span>
      {error ? (
        <small id={`${field.key}-error`} className="measure-field-error">
          {error}
        </small>
      ) : (
        previous && (
          <small>
            السابق: <bdi>{previous}</bdi>
          </small>
        )
      )}
    </label>
  );
}

function PreviousVisitCard({
  visit,
  onOpen,
  expanded,
  previousWeight,
}: {
  visit: MockVisit;
  onOpen: () => void;
  expanded: boolean;
  previousWeight?: string;
}) {
  const delta =
    previousWeight === undefined
      ? null
      : Number(visit.measurements.weight) - Number(previousWeight);
  return (
    <button
      type="button"
      className={`measure-visit ${expanded ? "expandable" : ""}`}
      onClick={onOpen}
      aria-label={`عرض قياسات الزيارة ${visit.number}`}
    >
      <div className="measure-visit-text">
        <strong>
          الزيارة {visit.number} · {visit.date}
        </strong>
        <span>
          <bdi>{visit.measurements.weight} كغ</bdi>
          {visit.kind === "full_exam" && " · قياس كامل"}
          <VisitBadge kind={visit.kind} />
        </span>
      </div>
      {delta !== null ? (
        <WeightDelta increase={delta > 0}>
          {Math.abs(delta).toFixed(1)} كغ
        </WeightDelta>
      ) : (
        <span className="measure-start">البداية</span>
      )}
      {expanded && (
        <span className="measure-chevron" aria-hidden="true">
          <Icon name="arrow" size={18} />
        </span>
      )}
    </button>
  );
}

function DetailCell({
  label,
  value,
  unit,
}: {
  label: string;
  value?: string;
  unit: string;
}) {
  return (
    <div className="measure-detail-cell">
      <span>{label}</span>
      <strong dir="ltr">
        {value ?? "—"} <small>{unit}</small>
      </strong>
    </div>
  );
}

function PreviousSheet({
  visit,
  onClose,
  onSave,
  shared = false,
  readOnly = false,
}: {
  visit: MockVisit;
  onClose: () => void;
  onSave: (measurements: VisitMeasurement) => void;
  shared?: boolean;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<VisitMeasurement>({
    ...visit.measurements,
  });
  const [errors, setErrors] = useState<Partial<Record<MeasurementKey, string>>>(
    {}
  );
  const sheetRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = sheetRef.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      // React may detach the dialog before native focus restoration runs.
      requestAnimationFrame(() => {
        if (trigger instanceof HTMLElement && trigger.isConnected)
          trigger.focus();
      });
    };
  }, []);

  const groups = [
    [
      measurementFields[0],
      { key: "bmi" as const, label: "BMI", unit: "", max: 100 },
      measurementFields[1],
      measurementFields[2],
      measurementFields[3],
      measurementFields[4],
    ],
    [
      measurementFields[5],
      measurementFields[8],
      measurementFields[6],
      measurementFields[7],
    ],
  ];
  function submitEdit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Partial<Record<MeasurementKey, string>> = {};
    for (const field of measurementFields) {
      if (draft[field.key] === undefined) continue;
      const error = validate(draft[field.key] ?? "", field.key);
      if (error) nextErrors[field.key] = error;
    }
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) {
      onSave(
        Object.fromEntries(
          Object.entries(draft).map(([key, value]) => [key, normalize(value)])
        )
      );
      setEditing(false);
    }
  }

  return (
    <dialog
      ref={sheetRef}
      className="measure-overlay"
      aria-label={`قياسات الزيارة ${visit.number}`}
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), a[href]"
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="measure-sheet">
        <div className="measure-handle" />
        <header className="measure-sheet-header">
          <div>
            <strong>
              الزيارة {visit.number} <VisitBadge kind={visit.kind} />
            </strong>
            <p>{visit.detailDate}</p>
          </div>
          <button
            type="button"
            className="measure-icon-button"
            onClick={onClose}
            aria-label="إغلاق التفاصيل"
          >
            <Icon name="close" size={20} />
          </button>
        </header>
        <form onSubmit={submitEdit} className="measure-sheet-body">
          {groups.map((fields, index) => {
            const available = fields.filter(
              (field) => visit.measurements[field.key] !== undefined
            );
            return (
              available.length > 0 && (
                <section key={index} className="measure-detail-section">
                  <h2>{index === 0 ? "الوزن ومكونات الجسم" : "المحيطات"}</h2>
                  <div
                    className={`measure-detail-grid${index === 1 ? " measure-circumferences" : ""}`}
                  >
                    {available.map((field) =>
                      editing && field.key !== "bmi" ? (
                        <NumericField
                          key={field.key}
                          field={field}
                          value={draft[field.key] ?? ""}
                          error={errors[field.key]}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              [field.key]: value,
                            }))
                          }
                        />
                      ) : (
                        <DetailCell
                          key={field.key}
                          label={
                            field.key === "fat"
                              ? "الدهون"
                              : field.key === "muscle"
                                ? "العضل"
                                : field.key === "visceral"
                                  ? "الحشوية"
                                  : field.label
                          }
                          value={visit.measurements[field.key]}
                          unit={field.key === "bmi" ? "" : field.unit}
                        />
                      )
                    )}
                  </div>
                </section>
              )
            );
          })}
          {!readOnly && (
            <p className="measure-info">
              <Icon name="info" size={16} />
              {shared
                ? "يُحفظ التعديل في هذا المتصفح ويظهر في ملف الطبيب التجريبي."
                : "التعديل تجريبي هنا فقط ولا يظهر للطبيب."}
            </p>
          )}
          <div className="measure-sheet-actions">
            {editing ? (
              <>
                <button type="submit" className="measure-primary">
                  حفظ التعديل محلياً
                </button>
                <button
                  type="button"
                  className="measure-secondary"
                  onClick={() => {
                    setEditing(false);
                    setDraft({ ...visit.measurements });
                    setErrors({});
                  }}
                >
                  إلغاء
                </button>
              </>
            ) : (
              <>
                {!readOnly && (
                  <button
                    type="button"
                    className="measure-soft"
                    onClick={(event) => {
                      // The same button becomes a submit control after this render.
                      // Cancel this click's default action before switching modes.
                      event.preventDefault();
                      setEditing(true);
                    }}
                  >
                    <Icon name="edit" size={18} />
                    تعديل القياسات
                  </button>
                )}
                <button
                  type="button"
                  className="measure-secondary"
                  onClick={onClose}
                >
                  إغلاق
                </button>
              </>
            )}
          </div>
        </form>
      </section>
    </dialog>
  );
}

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
  readOnlyHistory = false,
  pending = false,
  externalError,
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
  onComplete?: (measurements: VisitMeasurement) => void | Promise<void>;
  readOnlyHistory?: boolean;
  pending?: boolean;
  externalError?: React.ReactNode;
}) {
  const full = mode === "full-exam";
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
  const validWeight = validate(weight, "weight") === null;
  const currentWeight = Number(normalize(weight));
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
    if (pending) return;
    const nextErrors: Partial<Record<MeasurementKey, string>> = {};
    const fields = full ? measurementFields : measurementFields.slice(0, 1);
    for (const field of fields) {
      const error = validate(
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
              normalize(value),
            ])
          )
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
        <div className="measure-content">
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
                      { value: normalize(weight), date: "اليوم" },
                      ...visits.map((visit) => ({
                        value: visit.measurements.weight,
                        date: visit.date,
                      })),
                    ].map((item, index) => (
                      <div key={item.date}>
                        <strong dir="ltr">{item.value}</strong>
                        <span>{item.date}</span>
                        {index < visits.length && <i />}
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section className="measure-history">
                <h2>الزيارات السابقة ({visits.length})</h2>
                {expanded && <p>اضغط على أي زيارة لعرض قياساتها أو تعديلها</p>}
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
              {!expanded && !readOnlyHistory && (
                <Link className="measure-history-link" href={previousHref}>
                  عرض تفاصيل الزيارات السابقة <Icon name="arrow" size={16} />
                </Link>
              )}
            </>
          )}
          {externalError}
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
        </div>
        <footer className="measure-actionbar">
          <button type="submit" className="measure-primary" disabled={pending}>
            <Icon name="check" size={20} />
            {pending
              ? "جارٍ الحفظ…"
              : onComplete
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
