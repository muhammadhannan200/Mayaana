import type {
  VisitHistoryItem,
  VisitMeasurement,
} from "@/shared/clinical-model";

// Fictional design fixtures only. Never import these into a Supabase mutation.
// Replace this module's consumer with a clinic-scoped visits repository when available.
export type MockVisit = VisitHistoryItem;

export const followUpFixture = {
  patientName: "ريم الخطيب",
  visitNumber: 3,
  goal: "نقص وزن",
  currentWeight: "65.0",
  visits: [
    {
      id: "fictional-visit-2",
      number: 2,
      date: "2026-09-10",
      detailDate: "2026-09-10 · 10:20 ص · أدخلتها سارة",
      kind: "follow_up",
      measurements: { weight: "65.8" },
      delta: "2.1 كغ",
    },
    {
      id: "fictional-visit-1",
      number: 1,
      date: "2026-09-01",
      detailDate: "2026-09-01 · 11:40 ص · أدخلتها سارة",
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
