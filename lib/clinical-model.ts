// Framework-neutral clinical contracts. Keep this module free of React, route
// and demo imports: production, demo and tests all depend on it, never the reverse.
export type MeasurementKey =
  | "weight"
  | "fat"
  | "muscle"
  | "visceral"
  | "bmr"
  | "waist"
  | "arm"
  | "thigh"
  | "hip"
  | "bmi";

export type VisitMeasurement = Partial<Record<MeasurementKey, string>>;

export type VisitKind = "follow_up" | "full_exam";

export type VisitHistoryItem = {
  id: string;
  number: number;
  date: string;
  detailDate: string;
  kind: VisitKind;
  measurements: VisitMeasurement;
  starting?: boolean;
  delta?: string;
};

export type PatientRecord = {
  id: string;
  name: string;
  phone: string;
  height: string;
  gender: string;
  birthYear: string;
  goal: string;
  visits: (VisitHistoryItem & { appointment?: string; serviceDate?: string })[];
};

export type DietMeal = { id: string; type: string; description: string };
export type DietDay = { id: string; meals: DietMeal[] };
export type VisitDraft = {
  notes: string;
  days: DietDay[];
  appointment: string;
  completedAt?: string;
};

export type QueueEntry = {
  id: string;
  patientId: string;
  kind: VisitKind;
  status: "waiting" | "ready" | "with_doctor" | "completed";
  measurements: VisitMeasurement;
  arrivalTime?: string;
  handedOffAt?: string;
  doctorOpened?: boolean;
  visit?: VisitDraft;
};

export const measurementFields: {
  key: MeasurementKey;
  label: string;
  unit: string;
  max: number;
}[] = [
  { key: "weight", label: "الوزن", unit: "كغ", max: 200 },
  { key: "fat", label: "نسبة الدهون", unit: "%", max: 100 },
  { key: "muscle", label: "الكتلة العضلية", unit: "كغ", max: 300 },
  { key: "visceral", label: "الدهون الحشوية", unit: "مستوى", max: 100 },
  { key: "bmr", label: "الحرق الأساسي", unit: "kcal", max: 10000 },
  { key: "waist", label: "الخصر", unit: "سم", max: 300 },
  { key: "arm", label: "الذراع", unit: "سم", max: 200 },
  { key: "thigh", label: "الفخذ", unit: "سم", max: 200 },
  { key: "hip", label: "الورك", unit: "سم", max: 300 },
];
