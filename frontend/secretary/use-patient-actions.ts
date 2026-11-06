"use client";

import { useState, type FormEvent } from "react";
import type { useDemoClinic } from "@/frontend/demo/demo-clinic";
import type { PatientRecord, QueueEntry } from "@/shared/clinical-model";
import type {
  ClinicalOperations,
  ClinicalSnapshot,
} from "@/shared/clinical-types";
import {
  parsePatientFields,
  type PatientFieldErrors,
} from "@/shared/patient-validation";

// Reads Arabic-Indic and Persian digits as Latin digits for search and phones.
export const normalize = (value: string) =>
  value
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));

// The secretary's patient writes: add to the queue, edit a file, create a file.
export function usePatientActions({
  demo,
  patients,
  clinical,
  operations,
  update,
  go,
  setError,
}: {
  demo: boolean;
  patients: PatientRecord[];
  clinical?: ClinicalSnapshot;
  operations?: ClinicalOperations;
  update: ReturnType<typeof useDemoClinic>["update"];
  go: (path: string) => void;
  setError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("نقص وزن");
  const [fieldErrors, setFieldErrors] = useState<PatientFieldErrors>({});
  const [patientRequestId, setPatientRequestId] = useState<string | null>(null);
  async function enqueue(id: string, visitKind: QueueEntry["kind"]) {
    if (operations) {
      if (await operations.enqueuePatient(id, visitKind))
        go(`secretary?added=1&patient=${id}&kind=${visitKind}`);
      return;
    }
    update((state) =>
      state.queue.some((e) => e.patientId === id)
        ? state
        : {
            ...state,
            queue: [
              ...state.queue,
              {
                id: crypto.randomUUID(),
                patientId: id,
                kind: visitKind,
                status: "waiting",
                arrivalTime: new Date().toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                measurements: {},
              },
            ],
          }
    );
    go(`secretary?added=1&patient=${id}&kind=${visitKind}`);
  }
  async function savePatient(next: Omit<PatientRecord, "visits">) {
    const backToFile = `secretary/patients/${next.id}`;
    if (operations) {
      const revision = clinical?.patients.find(
        (p) => p.id === next.id
      )?.revision;
      if (
        revision !== undefined &&
        (await operations.updatePatient(next, revision))
      )
        go(backToFile);
      return;
    }
    update((state) => ({
      ...state,
      patients: state.patients.map((p) =>
        p.id === next.id ? { ...p, ...next } : p
      ),
    }));
    go(backToFile);
  }
  async function createPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const { phone, height, birthYear, errors } = parsePatientFields(
      data,
      name,
      normalize
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    if (demo && patients.some((p) => p.phone === phone)) {
      setError("يوجد ملف بهذا الهاتف. اختر الملف الموجود من البحث.");
      return;
    }
    const id = patientRequestId ?? crypto.randomUUID();
    if (operations) setPatientRequestId(id);
    const record: PatientRecord = {
      id,
      name: name.trim(),
      phone,
      height,
      gender: String(data.get("gender")),
      birthYear,
      goal,
      visits: [],
    };
    if (operations) {
      if (await operations.createPatient(record)) {
        setPatientRequestId(null);
        go(`secretary/confirm?patient=${id}`);
      }
      return;
    }
    update((state) => ({ ...state, patients: [...state.patients, record] }));
    go(`secretary/confirm?patient=${id}`);
  }
  return {
    name,
    setName,
    goal,
    setGoal,
    fieldErrors,
    enqueue,
    savePatient,
    createPatient,
  };
}
