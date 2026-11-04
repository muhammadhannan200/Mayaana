import Link from "next/link";
import type { FormEvent } from "react";
import { Icon } from "@/frontend/components/icon";
import type { PatientRecord } from "@/shared/clinical-model";
import type { PatientFieldErrors } from "@/shared/patient-validation";
import { FieldError } from "./field-error";

export function NewPatientScreen({
  name,
  onName,
  goal,
  onGoal,
  error,
  fieldErrors,
  patients,
  pending,
  href,
  onSubmit,
}: {
  name: string;
  onName: (name: string) => void;
  goal: string;
  onGoal: (goal: string) => void;
  error: string;
  fieldErrors: PatientFieldErrors;
  patients: PatientRecord[];
  pending?: boolean;
  href: (route: string) => string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="secretary-content new-patient-form"
      onSubmit={onSubmit}
      noValidate
    >
      <label className="secretary-field">
        الاسم الكامل *
        <input
          required
          minLength={2}
          maxLength={160}
          value={name}
          onChange={(e) => onName(e.target.value)}
          autoComplete="off"
          aria-invalid={!!fieldErrors.name}
        />
        <FieldError message={fieldErrors.name} />
      </label>
      {name.trim().length > 1 &&
        patients.some((p) => p.name.includes(name.trim())) && (
          <div className="similar-patient">
            <strong>يوجد مريض باسم مشابه</strong>
            <p>هل هو نفس الشخص؟ أضفه للدور بدل فتح ملف جديد.</p>
            <Link
              href={href(`secretary/add?q=${encodeURIComponent(name.trim())}`)}
            >
              عرض الملفات المشابهة
            </Link>
          </div>
        )}
      <label className="secretary-field">
        رقم الهاتف *
        <input
          name="phone"
          type="tel"
          required
          maxLength={20}
          dir="ltr"
          placeholder="09XX XXX XXX"
          aria-invalid={!!fieldErrors.phone}
        />
        <FieldError message={fieldErrors.phone} />
      </label>
      <div className="intake-two-columns">
        <label className="secretary-field">
          الطول *
          <input
            name="height"
            inputMode="decimal"
            required
            placeholder="مثال: 165 سم"
            aria-invalid={!!fieldErrors.height}
          />
          <FieldError message={fieldErrors.height} />
        </label>
        <label className="secretary-field">
          الجنس
          <select name="gender">
            <option value="female">أنثى</option>
            <option value="male">ذكر</option>
          </select>
        </label>
      </div>
      <label className="secretary-field">
        سنة الميلاد
        <input
          name="birthYear"
          inputMode="numeric"
          maxLength={4}
          placeholder="اختياري"
          aria-invalid={!!fieldErrors.birthYear}
        />
        <FieldError message={fieldErrors.birthYear} />
      </label>
      <fieldset className="goal-options">
        <legend>هدف المتابعة</legend>
        {["نقص وزن", "زيادة وزن"].map((value) => (
          <label key={value} className={goal === value ? "selected" : ""}>
            <input
              type="radio"
              name="goal"
              checked={goal === value}
              onChange={() => onGoal(value)}
            />
            <Icon name="down" />
            <span>{value}</span>
          </label>
        ))}
      </fieldset>
      <p className="intake-info">
        <Icon name="info" size={18} />
        أول زيارة تُسجّل كشفية مع قياس كامل.
      </p>
      {error && (
        <p className="secretary-error" role="alert">
          {error}
        </p>
      )}
      <div className="intake-actionbar">
        <button className="secretary-primary" type="submit" disabled={pending}>
          <Icon name="check" size={20} />
          حفظ ومتابعة الإضافة للدور
        </button>
        <Link className="secretary-outline" href={href("secretary/search")}>
          إلغاء
        </Link>
      </div>
    </form>
  );
}
