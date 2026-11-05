"use client";

import { useEffect, useRef } from "react";
import { dayCountLabel, mealCountLabel } from "@/shared/arabic-count";

export function FinishReview({
  patientName,
  weight,
  hasNotes,
  days,
  meals,
  appointment,
  disabled,
  stale,
  onFinish,
  onClose,
}: {
  patientName: string;
  weight?: string;
  hasNotes: boolean;
  days: number;
  meals: number;
  appointment: string;
  disabled?: boolean;
  stale: boolean;
  onFinish: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    ref.current?.showModal();
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="visit-review"
      aria-labelledby="finish-title"
      onCancel={onClose}
    >
      <h2 id="finish-title">قبل إنهاء الزيارة</h2>
      <p>راجع الملخص. بعد الحفظ يخرج المريض من الدور.</p>
      <dl className="visit-summary">
        <div>
          <dt>المريض</dt>
          <dd>{patientName}</dd>
        </div>
        <div>
          <dt>الوزن</dt>
          <dd>{weight} كغ</dd>
        </div>
        <div>
          <dt>الملاحظات</dt>
          <dd>{hasNotes ? "مكتوبة" : "بدون ملاحظات"}</dd>
        </div>
        <div>
          <dt>البرنامج الغذائي</dt>
          <dd>
            {dayCountLabel(days)} · {mealCountLabel(meals)}
          </dd>
        </div>
        <div>
          <dt>المراجعة القادمة</dt>
          <dd>{appointment}</dd>
        </div>
      </dl>
      <div className="visit-buttons">
        <button
          className="secretary-primary"
          onClick={onFinish}
          disabled={disabled || stale}
        >
          حفظ وإنهاء الزيارة
        </button>
        <button
          className="secretary-outline"
          disabled={disabled}
          onClick={() => onClose()}
        >
          رجوع
        </button>
      </div>
    </dialog>
  );
}
