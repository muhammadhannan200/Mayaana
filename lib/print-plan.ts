// A patient-facing allowlist, deliberately independent of clinical snapshots.
export type PrintDay = {
  meals: { type: string; description: string }[];
};
export type PrintPlan = {
  clinicName: string;
  patientName: string;
  visitDate: string;
  days: PrintDay[];
  appointment: string;
};
export type PrintResult =
  | { kind: "ready"; plan: PrintPlan }
  | { kind: "denied" | "unavailable" | "incomplete" | "error" };

export const printMessages = {
  denied: "لا تملك صلاحية عرض البرنامج. هذه الصفحة متاحة لطبيب العيادة فقط.",
  unavailable:
    "الزيارة غير متاحة. عد إلى قائمة الزيارات واختر زيارة من عيادتك.",
  incomplete: "لا يمكن طباعة البرنامج قبل اكتمال الزيارة. أكمل الزيارة أولاً.",
  error: "تعذّر تحميل البرنامج. أعد تحميل الصفحة أو حاول لاحقاً.",
};

// JSON is untrusted, including browser-local demo data. Copy only printable
// fields, never spread a day/meal object into the patient-facing payload.
export function printableDays(value: unknown): PrintDay[] {
  if (!Array.isArray(value) || !value.length || value.length > 60)
    throw new Error("Invalid diet days");
  return value.map((day) => {
    if (
      !day ||
      !Array.isArray(day.meals) ||
      !day.meals.length ||
      day.meals.length > 12
    )
      throw new Error("Invalid diet day");
    return {
      meals: day.meals.map((meal: unknown) => {
        if (
          !meal ||
          typeof meal !== "object" ||
          !("type" in meal) ||
          typeof meal.type !== "string" ||
          !("description" in meal) ||
          typeof meal.description !== "string" ||
          !meal.description.trim() ||
          meal.description.length > 2000
        )
          throw new Error("Invalid diet meal");
        return { type: meal.type, description: meal.description };
      }),
    };
  });
}
