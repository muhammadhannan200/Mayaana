import type { DemoEntry } from "./demo-clinic";

export const doctorOccupiedMessage =
  "يوجد مريض عند الطبيب بالفعل. أنهِ زيارته قبل إدخال مريض آخر.";

export type DemoHandoffOutcome =
  | "sent"
  | "retry"
  | "occupied"
  | "unavailable"
  | "unsupported"
  | "storage_unavailable";

// Called inside the demo store's cross-tab write lock, never on a stale view.
export function handoffQueue(queue: DemoEntry[], id: string) {
  const entry = queue.find((item) => item.id === id);
  if (!entry) return { queue, outcome: "unavailable" as const };
  if (entry.status === "with_doctor" || entry.status === "completed")
    return { queue, outcome: "retry" as const };
  if (entry.status !== "ready")
    return { queue, outcome: "unavailable" as const };
  if (queue.some((item) => item.status === "with_doctor"))
    return { queue, outcome: "occupied" as const };
  return {
    queue: queue.map((item) =>
      item.id === id ? { ...item, status: "with_doctor" as const } : item
    ),
    outcome: "sent" as const,
  };
}
