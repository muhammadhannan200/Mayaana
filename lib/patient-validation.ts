// UI validation mirrors the current create-patient interface; it does not
// replace database validation or broaden which demographics are mandatory.
export const normalizePatientInput = (value: string) =>
  value
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));

export function patientFieldErrors(
  data: FormData,
  year = new Date().getFullYear()
) {
  const name = String(data.get("name") ?? "").trim();
  const phone = normalizePatientInput(String(data.get("phone") ?? "")).replace(
    /[\s()-]/g,
    ""
  );
  const height = normalizePatientInput(
    String(data.get("height") ?? "")
  ).replace(/[٫,]/g, ".");
  const birthYear = normalizePatientInput(String(data.get("birthYear") ?? ""));
  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 160)
    errors.name = "أدخل الاسم الكامل (حرفان على الأقل).";
  if (!/^\+?\d{6,15}$/.test(phone))
    errors.phone = "أدخل رقم هاتف صحيحاً (6–15 رقماً).";
  if (
    !/^[0-9]+([.][0-9]{1,2})?$/.test(height) ||
    Number(height) < 50 ||
    Number(height) > 250
  )
    errors.height = "أدخل الطول بين 50 و250 سم.";
  if (
    birthYear &&
    (!/^\d{4}$/.test(birthYear) ||
      Number(birthYear) < 1900 ||
      Number(birthYear) > year)
  )
    errors.birthYear = "أدخل سنة ميلاد بين 1900 والسنة الحالية.";
  return errors;
}
