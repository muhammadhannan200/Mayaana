"use client";

import { useDemoClinic } from "@/frontend/demo/demo-clinic";
import { printableDays, type PrintResult } from "@/shared/print-plan";
import { PrintScreen } from "./screen";

export function DemoPrintPlan({ entryId }: { entryId: string }) {
  const { queue, patients } = useDemoClinic();
  const entry = queue.find((item) => item.id === entryId);
  const patient = patients.find((item) => item.id === entry?.patientId);
  let result: PrintResult = { kind: "unavailable" };
  if (entry && patient) {
    if (entry.status !== "completed") result = { kind: "incomplete" };
    else if (entry.visit?.completedAt) {
      try {
        result = {
          kind: "ready",
          plan: {
            clinicName: "عيادة Mayaana التجريبية الخيالية",
            patientName: patient.name,
            visitDate: entry.visit.completedAt,
            days: printableDays(entry.visit.days),
            appointment: entry.visit.appointment,
          },
        };
      } catch {
        result = { kind: "error" };
      }
    }
  }
  return <PrintScreen result={result} demo />;
}
