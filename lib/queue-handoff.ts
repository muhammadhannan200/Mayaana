// Neutral structural contract: both persistence owners can use the policy
// without importing fictional records, React, routes or backend infrastructure.
export type QueueHandoffEntry = {
  id: string;
  status: "waiting" | "ready" | "with_doctor" | "completed";
};

export const doctorOccupiedMessage =
  "يوجد مريض عند الطبيب بالفعل. أنهِ زيارته قبل إدخال مريض آخر.";

export type QueueHandoffOutcome = "sent" | "retry" | "occupied" | "unavailable";

// Callers own serialization and must supply the latest authoritative queue.
export function handoffQueue<T extends QueueHandoffEntry>(
  queue: T[],
  id: string
): {
  queue: T[];
  outcome: QueueHandoffOutcome;
} {
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
