import type { QueueEntry } from "./clinical-model";

export type ClinicNotification = { id: string; text: string; time?: string };

type Role = "doctor" | "secretary";

// Derived from today's queue, so a status change produces a new notification.
export function clinicNotifications(
  role: Role,
  queue: QueueEntry[],
  nameOf: (entry: QueueEntry) => string
): ClinicNotification[] {
  const items = queue.flatMap((entry): ClinicNotification[] => {
    const name = nameOf(entry);
    const item = (text: string) => ({
      id: `${entry.id}:${entry.status}:${entry.doctorOpened ? 1 : 0}`,
      text,
      time: entry.arrivalTime,
    });
    if (role === "doctor") {
      if (entry.status === "waiting") return [item(`أُضيف ${name} إلى الدور`)];
      if (entry.status === "ready")
        return [item(`${name} جاهز للدخول، اكتملت القياسات`)];
      if (entry.status === "with_doctor")
        return [item(`أدخلت السكرتيرة ${name} إليك`)];
      return [];
    }
    if (entry.status === "with_doctor" && entry.doctorOpened)
      return [item(`فتح الطبيب زيارة ${name}`)];
    if (entry.status === "completed") return [item(`انتهت زيارة ${name}`)];
    return [];
  });
  return items.reverse().slice(0, 20);
}
