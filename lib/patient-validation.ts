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
  const valid =
    name.trim().length >= 2 &&
    /^\+?\d{6,15}$/.test(phone) &&
    Number.isFinite(Number(height)) &&
    Number(height) >= 50 &&
    Number(height) <= 250 &&
    (!birthYear ||
      (/^\d{4}$/.test(birthYear) &&
        Number(birthYear) >= 1900 &&
        Number(birthYear) <= new Date().getFullYear()));
  return { phone, height, birthYear, valid };
}

export const patientFieldsError =
  "تحقق من الاسم والهاتف والطول (50–250 سم) وسنة الميلاد.";
