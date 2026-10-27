"use client";

import type { ClinicalResult, ClinicalSnapshot } from "@/lib/clinical-types";

const key = "batch-2-synthetic-snapshot";
const initial: ClinicalSnapshot = {
  clinicId: "synthetic-clinic",
  role: "secretary",
  serviceDate: "2026-10-27",
  hasMore: false,
  patients: ["ريم الخطيب", "سامر خالد الحلبي", "محمد العلي"].map((name, i) => ({
    id: `patient-${i}`,
    name,
    phone: `+1202555012${i}`,
    gender: "female",
    birthYear: "1990",
    height: "170",
    goal: "نقص وزن",
    visits: [],
    revision: 1,
  })),
  queue: [0, 1, 2].map((i) => ({
    id: `entry-${i}`,
    patientId: `patient-${i}`,
    kind: "follow_up",
    status: "ready",
    measurements: { weight: "70" },
    revision: 7,
    arrivalTime: "10:20",
  })),
};
function snapshot(): ClinicalSnapshot {
  return JSON.parse(sessionStorage.getItem(key) ?? JSON.stringify(initial));
}
export async function getClinicScreen(): Promise<
  ClinicalResult<ClinicalSnapshot>
> {
  if (
    new URLSearchParams(location.search).get("result") === "refresh-failure" &&
    sessionStorage.getItem(key)
  )
    return {
      ok: false,
      kind: "network",
      message: "تعذّر تحديث البيانات الاختبارية.",
    };
  return { ok: true, data: snapshot() };
}
export async function handoffToDoctor(
  id: string,
  revision: number,
  requestId: string
): Promise<ClinicalResult<null>> {
  const mode = new URLSearchParams(location.search).get("result");
  // Exposes transport arguments only in this synthetic app for contract tests.
  sessionStorage.setItem(
    "batch-2-synthetic-last-request",
    JSON.stringify({ id, revision, requestId })
  );
  const delay = Number(new URLSearchParams(location.search).get("delay") ?? 0);
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  if (mode === "throw") throw new Error("Synthetic transport failure");
  if (
    mode === "auth" ||
    mode === "conflict" ||
    mode === "validation" ||
    mode === "network"
  )
    return { ok: false, kind: mode, message: "تعذّر تسليم المريض الاختباري." };
  const data = snapshot();
  data.queue = data.queue.map((entry) =>
    entry.id === id
      ? { ...entry, status: "with_doctor", revision: entry.revision + 1 }
      : entry
  );
  sessionStorage.setItem(key, JSON.stringify(data));
  return { ok: true, data: null };
}
async function unsupported(): Promise<ClinicalResult<null>> {
  return {
    ok: false,
    kind: "validation",
    message: "غير متاح في المعاينة الاختبارية.",
  };
}
export const createPatient = unsupported;
export const enqueuePatient = unsupported;
export const saveMeasurements = unsupported;
export const saveDoctorDraft = unsupported;
export const finishVisit = unsupported;
