"use server";

// These explicit server functions always reauthenticate; layouts are not a write guard.
import * as clinical from "@/lib/clinical";
import type { PatientInput, ScreenRequest } from "@/lib/clinical-types";
import type { DemoVisit } from "@/lib/demo-clinic";
import type { VisitMeasurement } from "./secretary/measurements/mock-visits";

export async function getClinicScreen(input: ScreenRequest) {
  return clinical.getClinicScreen(input);
}
export async function createPatient(input: PatientInput) {
  return clinical.createPatient(input);
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
export async function saveDoctorDraft(
  entry: string,
  revision: number,
  draft: DemoVisit
) {
  return clinical.saveDoctorDraft(entry, revision, draft);
}
export async function finishVisit(
  entry: string,
  revision: number,
  request: string,
  draft: DemoVisit
) {
  return clinical.finishVisit(entry, revision, request, draft);
}
