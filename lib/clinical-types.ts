import type {
  PatientRecord,
  QueueEntry,
  VisitDraft,
  VisitMeasurement,
} from "./clinical-model";

export type ClinicPatient = PatientRecord & { revision: number };
export type ClinicEntry = QueueEntry & { revision: number; visitId?: string };
export type ClinicalSnapshot = {
  clinicId: string;
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
export type PatientInput = Omit<PatientRecord, "visits">;
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
    kind: QueueEntry["kind"]
  ) => Promise<boolean>;
  saveMeasurements: (
    entry: string,
    values: VisitMeasurement,
    revision?: number
  ) => Promise<boolean>;
  handoffToDoctor: (entry: string) => Promise<boolean>;
  cancelHandoff: (entry: string) => Promise<boolean>;
  openVisit: (entry: string) => Promise<void>;
  saveDoctorDraft: (
    entry: string,
    revision: number,
    draft: VisitDraft
  ) => Promise<boolean>;
  finishVisit: (
    entry: string,
    revision: number,
    draft: VisitDraft
  ) => Promise<boolean>;
  search: (term: string) => void;
  nextPage: () => void;
};
