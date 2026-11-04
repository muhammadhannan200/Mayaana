import { classifyAgenda, type AgendaAppointment } from "../../shared/doctor-agenda";
import type { DemoState } from "./demo-fixture";

// Read only appointment and completion metadata from fictional local records.
// The demo's queue is its current-day queue, as elsewhere in /demo.
export function demoAgenda(state: DemoState, today: string) {
  const appointments: AgendaAppointment[] = [];
  const completed: { patientId: string; date: string }[] = [];
  for (const patient of state.patients)
    for (const visit of patient.visits) {
      if (visit.appointment)
        appointments.push({ patientId: patient.id, date: visit.appointment });
      // Older demo records may contain localized display dates, not ISO dates.
      const date = visit.serviceDate ?? visit.date;
      if (/^\d{4}-\d{2}-\d{2}$/.test(date))
        completed.push({ patientId: patient.id, date });
    }
  for (const entry of state.queue)
    if (entry.visit?.appointment)
      appointments.push({
        patientId: entry.patientId,
        date: entry.visit.appointment,
      });
  return classifyAgenda(
    today,
    state.patients,
    appointments,
    state.queue.map((entry) => entry.patientId),
    completed
  );
}
