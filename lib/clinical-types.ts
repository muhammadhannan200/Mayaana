import type { DemoEntry, DemoPatient, DemoVisit } from "./demo-clinic";
import type { VisitMeasurement } from "@/app/secretary/measurements/mock-visits";

// Presentation shapes are shared with the retained UI, not its fictional store.
export type ClinicPatient = DemoPatient & { revision: number };
export type ClinicEntry = DemoEntry & { revision: number; visitId?: string };
export type ClinicalSnapshot = {
  patients: ClinicPatient[];
  queue: ClinicEntry[];
  hasMore: boolean;
  role: "doctor" | "secretary";
  serviceDate: string;
};
export type ClinicalFailure = {
  ok: false;
  kind: "auth" | "conflict" | "validation" | "network";
  message: string;
};
export type ClinicalResult<T> = { ok: true; data: T } | ClinicalFailure;
export type PatientInput = Omit<DemoPatient, "visits">;
export type ScreenRequest = {
  term: string;
  page: number;
  patient?: string;
  entry?: string;
};
export type ClinicalOperations = {
  pending: boolean;
  createPatient: (patient: PatientInput) => Promise<boolean>;
  enqueuePatient: (
    patient: string,
    kind: DemoEntry["kind"]
  ) => Promise<boolean>;
  saveMeasurements: (
    entry: string,
    values: VisitMeasurement,
    revision?: number
  ) => Promise<boolean>;
  handoffToDoctor: (entry: string) => Promise<boolean>;
  saveDoctorDraft: (
    entry: string,
    revision: number,
    draft: DemoVisit
  ) => Promise<boolean>;
  finishVisit: (
    entry: string,
    revision: number,
    draft: DemoVisit
  ) => Promise<boolean>;
  search: (term: string) => void;
  nextPage: () => void;
};
