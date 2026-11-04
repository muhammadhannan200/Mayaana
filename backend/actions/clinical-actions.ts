"use server";

// These explicit server functions always reauthenticate; layouts are not a write guard.
import * as clinical from "@/backend/clinical";
import type {
  PatientInput,
  QueueRemovalReason,
  ScreenRequest,
} from "@/shared/clinical-types";
import type { VisitDraft, VisitMeasurement } from "@/shared/clinical-model";

export async function getClinicScreen(input: ScreenRequest) {
  return clinical.getClinicScreen(input);
}
export async function createPatient(input: PatientInput) {
  return clinical.createPatient(input);
}
export async function updatePatient(input: PatientInput, revision: number) {
  return clinical.updatePatient(input, revision);
}
export async function enqueuePatient(patient: string, kind: string) {
  return clinical.enqueuePatient(patient, kind);
}
export async function saveMeasurements(
  entry: string,
  revision: number,
  values: VisitMeasurement,
  request: string
) {
  return clinical.saveMeasurements(entry, revision, values, request);
}
export async function handoffToDoctor(
  entry: string,
  revision: number,
  request: string
) {
  return clinical.handoffToDoctor(entry, revision, request);
}
export async function removeFromQueue(
  entry: string,
  revision: number,
  reason: QueueRemovalReason
) {
  return clinical.removeFromQueue(entry, revision, reason);
}

export async function cancelHandoff(entry: string, revision: number) {
  return clinical.cancelHandoff(entry, revision);
}
export async function openVisit(entry: string) {
  return clinical.openVisit(entry);
}
export async function saveDoctorDraft(
  entry: string,
  revision: number,
  draft: VisitDraft
) {
  return clinical.saveDoctorDraft(entry, revision, draft);
}
export async function finishVisit(
  entry: string,
  revision: number,
  request: string,
  draft: VisitDraft
) {
  return clinical.finishVisit(entry, revision, request, draft);
}
