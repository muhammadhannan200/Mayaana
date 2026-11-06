import type { DemoState } from "@/frontend/demo/demo-fixture";
import type { VisitDraft } from "@/shared/clinical-model";
import { damascusDate } from "@/shared/doctor-agenda";

// Fictional demo only: finishes a visit in browser state and adds it to the
// patient's history. The real clinic does this in clinical_finish_visit.
export function completeDemoVisit(
  state: DemoState,
  entryId: string,
  finished: VisitDraft & { completedAt: string }
): DemoState {
  const active = state.queue.find((item) => item.id === entryId);
  if (!active || active.status !== "with_doctor") return state;
  return {
    ...state,
    queue: state.queue.map((item) =>
      item.id === entryId
        ? {
            ...item,
            status: "completed",
            visit: finished,
          }
        : item
    ),
    patients: state.patients.map((record) =>
      record.id === active.patientId
        ? {
            ...record,
            visits: [
              {
                id: entryId,
                number: record.visits.length + 1,
                date: new Date(finished.completedAt).toLocaleDateString(
                  "ar-SY"
                ),
                serviceDate: damascusDate(new Date(finished.completedAt)),
                appointment: finished.appointment,
                detailDate: "زيارة مكتملة · العرض التجريبي",
                kind: active.kind,
                measurements: { ...active.measurements },
              },
              ...record.visits,
            ],
          }
        : record
    ),
  };
}
