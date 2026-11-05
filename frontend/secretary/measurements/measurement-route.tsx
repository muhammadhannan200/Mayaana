"use client";

import Link from "next/link";
import type { useDemoClinic } from "@/frontend/demo/demo-clinic";
import type { PatientRecord, QueueEntry } from "@/shared/clinical-model";
import type {
  ClinicalOperations,
  ClinicalSnapshot,
} from "@/shared/clinical-types";
import { MeasurementScreen } from "./measurement-screen";

export function MeasurementRoute({
  route,
  entry,
  patient,
  local,
  clinical,
  operations,
  href,
  go,
}: {
  route: string;
  entry?: QueueEntry;
  patient?: PatientRecord;
  local?: ReturnType<typeof useDemoClinic>;
  clinical?: ClinicalSnapshot;
  operations?: ClinicalOperations;
  href: (path: string) => string;
  go: (path: string) => void;
}) {
  const update: ReturnType<typeof useDemoClinic>["update"] =
    local?.update ??
    (() => {
      throw new Error("Authenticated data requires a clinical operation");
    });
  if (
    !entry ||
    !patient ||
    entry.status === "with_doctor" ||
    entry.status === "completed"
  )
    return (
      <main className="secretary-shell recovery" dir="rtl">
        <h1>اختر مريضاً من الدور</h1>
        <Link className="secretary-primary" href={href("secretary")}>
          العودة للدور
        </Link>
      </main>
    );
  const mode = route.endsWith("previous")
    ? "previous"
    : entry.kind === "full_exam"
      ? "full-exam"
      : "follow-up";
  return (
    <MeasurementScreen
      // Remount when the demo calendar settles after hydration, so history
      // seeded in useState does not keep the prerendered dates.
      key={`${entry.id}-${mode}-${local?.today ?? ""}`}
      mode={mode}
      patientName={patient.name}
      history={patient.visits}
      draft={entry.measurements}
      closeHref={href("secretary")}
      historyHref={href(`secretary/measurements/previous?entry=${entry.id}`)}
      pending={operations?.pending}
      revision={clinical?.queue.find((row) => row.id === entry.id)?.revision}
      readOnlyHistory={!!operations}
      onDraftChange={
        operations
          ? undefined
          : (measurements) =>
              update((state) => ({
                ...state,
                queue: state.queue.map((e) =>
                  e.id === entry.id
                    ? { ...e, measurements, status: "waiting" }
                    : e
                ),
              }))
      }
      onHistoryChange={
        operations
          ? undefined
          : (visits) =>
              update((state) => ({
                ...state,
                patients: state.patients.map((p) =>
                  p.id === patient.id ? { ...p, visits } : p
                ),
              }))
      }
      onComplete={async (measurements, revision) => {
        if (operations) {
          if (
            await operations.saveMeasurements(entry.id, measurements, revision)
          )
            go("secretary?measured=1");
          return;
        }
        update((state) => ({
          ...state,
          queue: state.queue.map((e) =>
            e.id === entry.id ? { ...e, measurements, status: "ready" } : e
          ),
        }));
        go("secretary?measured=1");
      }}
    />
  );
}
