export type PatientFieldErrors = Partial<
  Record<"name" | "phone" | "height" | "birthYear", string>
>;

export function parsePatientFields(
  data: FormData,
  name: string,
  normalize: (value: string) => string
) {
  const phone = normalize(String(data.get("phone") ?? "")).replace(
    /[\s()-]/g,
    ""
  );
  const height = normalize(String(data.get("height") ?? ""));
  const birthYear = normalize(String(data.get("birthYear") ?? ""));
  const errors: PatientFieldErrors = {};
  if (name.trim().length < 2) errors.name = "أدخل الاسم الكامل.";
  if (!/^\+?\d{6,15}$/.test(phone))
    errors.phone = "أدخل رقم هاتف صحيحاً من 6 إلى 15 رقماً.";
  if (
    !height ||
    !Number.isFinite(Number(height)) ||
    Number(height) < 50 ||
    Number(height) > 250
  )
    errors.height = "أدخل الطول بين 50 و250 سم.";
  if (
    birthYear &&
    (!/^\d{4}$/.test(birthYear) ||
      Number(birthYear) < 1900 ||
      Number(birthYear) > new Date().getFullYear())
  )
    errors.birthYear = "أدخل سنة ميلاد صحيحة من 4 أرقام.";
  return { phone, height, birthYear, errors };
}
