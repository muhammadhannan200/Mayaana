"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/frontend/components/icon";
import type { PatientRecord } from "@/shared/clinical-model";
import {
  parsePatientFields,
  type PatientFieldErrors,
} from "@/shared/patient-validation";
import { FieldError } from "./field-error";

export function PatientEditForm({
  patient,
  backHref,
  normalize,
  pending,
  onSave,
}: {
  patient: PatientRecord;
  backHref: string;
  normalize: (value: string) => string;
  pending?: boolean;
  onSave: (next: Omit<PatientRecord, "visits">) => Promise<void>;
}) {
  const [name, setName] = useState(patient.name);
  const [goal, setGoal] = useState(patient.goal || "نقص وزن");
  const [fieldErrors, setFieldErrors] = useState<PatientFieldErrors>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fields = parsePatientFields(data, name, normalize);
    setFieldErrors(fields.errors);
    if (Object.keys(fields.errors).length) return;
    await onSave({
      id: patient.id,
      name: name.trim(),
      phone: fields.phone,
      height: fields.height,
      gender: String(data.get("gender")),
      birthYear: fields.birthYear,
      goal,
    });
  }

  return (
    <form
      className="secretary-content new-patient-form"
      onSubmit={submit}
      noValidate
    >
      <label className="secretary-field">
        الاسم الكامل *
        <input
          required
          minLength={2}
          maxLength={160}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          aria-invalid={!!fieldErrors.name}
        />
        <FieldError message={fieldErrors.name} />
      </label>
      <label className="secretary-field">
        رقم الهاتف *
        <input
          name="phone"
          type="tel"
          required
          maxLength={20}
          dir="ltr"
          defaultValue={patient.phone}
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
            defaultValue={patient.height}
            aria-invalid={!!fieldErrors.height}
          />
          <FieldError message={fieldErrors.height} />
        </label>
        <label className="secretary-field">
          الجنس
          <select name="gender" defaultValue={patient.gender}>
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
          defaultValue={patient.birthYear}
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
              onChange={() => setGoal(value)}
            />
            <Icon name="down" />
            <span>{value}</span>
          </label>
        ))}
      </fieldset>
      <div className="intake-actionbar">
        <button className="secretary-primary" type="submit" disabled={pending}>
          <Icon name="check" size={20} />
          حفظ التعديلات
        </button>
        <Link className="secretary-outline" href={backHref}>
          إلغاء
        </Link>
      </div>
    </form>
  );
}
