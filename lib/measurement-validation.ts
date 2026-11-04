import { measurementFields, type MeasurementKey } from "./clinical-model.ts";

// Accepts Arabic and Persian digits and decimal separators from staff keyboards.
export function normalizeMeasurement(value: string) {
  return value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٫,]/g, ".");
}

export function validateMeasurement(
  value: string,
  key: MeasurementKey
): string | null {
  const normalized = normalizeMeasurement(value);
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
