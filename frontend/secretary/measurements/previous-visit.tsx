"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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
import { NumericField, VisitBadge, WeightDelta } from "./measurement-parts";
import type { MockVisit } from "./mock-visits";
import "./measurements.css";

export function PreviousVisitCard({
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

export function PreviousSheet({
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
      const error = validateMeasurement(draft[field.key] ?? "", field.key);
      if (error) nextErrors[field.key] = error;
    }
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) {
      onSave(
        Object.fromEntries(
          Object.entries(draft).map(([key, value]) => [
            key,
            normalizeMeasurement(value),
          ])
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
          <p className="measure-info">
            <Icon name="info" size={16} />
            {readOnly
              ? "قياسات زيارة مكتملة · للقراءة فقط."
              : shared
                ? "يُحفظ التعديل في هذا المتصفح ويظهر في ملف الطبيب التجريبي."
                : "التعديل تجريبي هنا فقط ولا يظهر للطبيب."}
          </p>
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
