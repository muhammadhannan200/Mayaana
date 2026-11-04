import type { DietDay } from "./clinical-model";

// Opens WhatsApp with a prepared message; the doctor presses send. Uses only
// the patient-safe plan and appointment, never private doctor notes.
export function whatsappPhone(phone: string) {
  const digits = phone
    .replace(/[^\d+]/g, "")
    .replace(/^\+/, "")
    .replace(/^00/, "");
  const local = digits.startsWith("09") ? `963${digits.slice(1)}` : digits;
  return /^\d{8,15}$/.test(local) ? local : null;
}

export function dietPlanMessage(plan: {
  patientName: string;
  days: DietDay[];
  appointment?: string;
}) {
  const days = plan.days.map((day, index) =>
    [
      `اليوم ${index + 1}`,
      ...day.meals.map((meal) => `${meal.type}: ${meal.description}`),
    ].join("\n")
  );
  return [
    `مرحباً ${plan.patientName}،`,
    "هذا برنامجك الغذائي:",
    ...days,
    ...(plan.appointment ? [`موعد المراجعة: ${plan.appointment}`] : []),
  ].join("\n\n");
}

export function whatsappUrl(phone: string, message: string) {
  const number = whatsappPhone(phone);
  return number
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : null;
}
