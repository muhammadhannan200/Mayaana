import type { VisitMeasurement } from "@/app/secretary/measurements/mock-visits";

export type ClinicalPatient = {
  id: string;
  name: string;
  phone: string;
  height: string;
  gender: string;
  birthYear: string;
  goal: string;
};
export type ClinicalEntry = {
  id: string;
  patientId: string;
  visitId: string | null;
  kind: "follow_up" | "full_exam";
  status: "waiting" | "ready" | "with_doctor";
  serviceDate: string;
  revision: number;
  arrivalTime: string;
  measurements: VisitMeasurement;
};
export type ClinicalSnapshot = {
  patients: ClinicalPatient[];
  entries: ClinicalEntry[];
};
export type ClinicalCommand =
  | { type: "patient"; patient: ClinicalPatient }
  | { type: "enqueue"; patientId: string; kind: ClinicalEntry["kind"] }
  | {
      type: "measure";
      entryId: string;
      revision: number;
      requestId: string;
      measurements: VisitMeasurement;
    }
  | { type: "handoff"; entryId: string; revision: number };

export type ClinicalResult<T> =
  { data: T; error?: never } | { error: string; data?: never };

// Matches the nine existing UI fields; no fixtures, notes or unsupported vitals.
export const measurementColumns = {
  weight: "weight_kg",
  fat: "body_fat_percent",
  muscle: "muscle_mass_kg",
  visceral: "visceral_fat_level",
  bmr: "basal_metabolic_rate_kcal",
  waist: "waist_cm",
  arm: "arm_cm",
  thigh: "thigh_cm",
  hip: "hip_cm",
} as const;
