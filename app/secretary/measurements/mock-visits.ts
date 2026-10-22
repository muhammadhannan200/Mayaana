// Fictional design fixtures only. Never import these into a Supabase mutation.
// Replace this module's consumer with a clinic-scoped visits repository when available.
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
export type MockVisit = {
  id: string;
  number: number;
  date: string;
  detailDate: string;
  kind: "follow_up" | "full_exam";
  measurements: VisitMeasurement;
  starting?: boolean;
  delta?: string;
};

export const followUpFixture = {
  patientName: "ريم الخطيب",
  visitNumber: 3,
  goal: "نقص وزن",
  currentWeight: "65.0",
  visits: [
    {
      id: "fictional-visit-2",
      number: 2,
      date: "10 أيلول",
      detailDate: "الخميس 10 أيلول 2026 · 10:20 ص · أدخلتها سارة",
      kind: "follow_up",
      measurements: { weight: "65.8" },
      delta: "2.1 كغ",
    },
    {
      id: "fictional-visit-1",
      number: 1,
      date: "1 أيلول",
      detailDate: "الإثنين 1 أيلول 2026 · 11:40 ص · أدخلتها سارة",
      kind: "full_exam",
      starting: true,
      measurements: {
        weight: "67.9",
        bmi: "26.5",
        fat: "35.0",
        muscle: "22.1",
        visceral: "8",
        bmr: "1360",
        waist: "84",
        hip: "104",
        arm: "29",
        thigh: "58",
      },
    },
  ] satisfies MockVisit[],
};

export const fullExamFixture = {
  patientName: "سامر الحلبي",
  visitNumber: 5,
  previous: {
    weight: "90.1",
    fat: "33.0",
    muscle: "33.4",
    visceral: "14",
    bmr: "1932",
    waist: "98",
    arm: "31",
    thigh: "52",
    hip: "111",
  } as VisitMeasurement,
  current: {
    weight: "82.7",
    fat: "30.0",
    muscle: "34.6",
    visceral: "12",
    bmr: "1822",
    waist: "89",
    arm: "31",
    thigh: "49",
    hip: "103",
  } as VisitMeasurement,
};

export const measurementFields: {
  key: MeasurementKey;
  label: string;
  unit: string;
  max: number;
}[] = [
  { key: "weight", label: "الوزن", unit: "كغ", max: 500 },
  { key: "fat", label: "نسبة الدهون", unit: "%", max: 100 },
  { key: "muscle", label: "الكتلة العضلية", unit: "كغ", max: 300 },
  { key: "visceral", label: "الدهون الحشوية", unit: "مستوى", max: 100 },
  { key: "bmr", label: "الحرق الأساسي", unit: "kcal", max: 10000 },
  { key: "waist", label: "الخصر", unit: "سم", max: 300 },
  { key: "arm", label: "الذراع", unit: "سم", max: 200 },
  { key: "thigh", label: "الفخذ", unit: "سم", max: 200 },
  { key: "hip", label: "الورك", unit: "سم", max: 300 },
];
