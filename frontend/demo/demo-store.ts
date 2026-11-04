import { createDemoFixture, type DemoState } from "./demo-fixture";
import {
  handoffCancelMs,
  handoffQueue,
  type QueueHandoffOutcome,
} from "../../shared/queue-handoff";

type DemoSnapshot = DemoState & { today: string };

function freeze<T extends object>(value: T): T {
  Object.values(value).forEach((child) => {
    if (child && typeof child === "object" && !Object.isFrozen(child))
      freeze(child);
  });
  return Object.freeze(value);
}

// Identical data for SSR and the browser's hydration pass, including cached HTML.
// Never read the wall clock or browser storage to construct this snapshot.
const bootstrapDate = "2026-09-22";
const bootstrap: DemoSnapshot = freeze({
  ...createDemoFixture(bootstrapDate),
  today: bootstrapDate,
});

function localDate(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Deliberately browser-only, versioned and isolated from real patient tables.
export function createDemoStore(scope: string) {
  const key = `mayanaa-demo-v1:${scope}`;
  let state = bootstrap;
  let published = state;
  let initial: DemoSnapshot | undefined;
  let loaded = false;
  let calendarTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  function browserInitial() {
    if (!initial) {
      const today = localDate(new Date());
      initial = { ...createDemoFixture(today), today };
    }
    return initial;
  }
  function read() {
    if (!loaded && typeof window !== "undefined") {
      loaded = true;
      state = browserInitial();
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as DemoState;
          if (
            Array.isArray(parsed.patients) &&
            Array.isArray(parsed.queue) &&
            parsed.patients.every(
              (p) =>
                typeof p.id === "string" &&
                typeof p.name === "string" &&
                Array.isArray(p.visits)
            ) &&
            parsed.queue.every(
              (e) =>
                typeof e.id === "string" &&
                parsed.patients.some((p) => p.id === e.patientId) &&
                ["waiting", "ready", "with_doctor", "completed"].includes(
                  e.status
                ) &&
                e.measurements
            )
          )
            state = {
              patients: parsed.patients,
              queue: parsed.queue,
              today: state.today,
            };
        }
      } catch {
        /* Unavailable or stale storage: keep the functional in-memory demo. */
      }
    }
    if (typeof window !== "undefined") {
      const today = localDate(new Date());
      // Advance only runtime metadata. Never rebase records, drafts or custom
      // appointments, reset the seed, or persist anything on a calendar tick.
      if (state.today !== today) state = { ...state, today };
    }
    return state;
  }

  function currentDate() {
    const current = read();
    // A getSnapshot read may already have advanced metadata before a delayed
    // timer runs. Still publish that change to every other mounted consumer.
    if (current !== published) notify();
    return current.today;
  }
  function notify() {
    published = state;
    listeners.forEach((fn) => fn());
  }
  function scheduleCalendar() {
    clearTimeout(calendarTimer);
    if (!listeners.size) return;
    const now = new Date();
    const midnight = new Date(now.getTime());
    // Local calendar arithmetic also handles 23/25-hour daylight-saving days.
    midnight.setHours(24, 0, 0, 0);
    calendarTimer = setTimeout(
      wake,
      Math.max(1, midnight.getTime() - now.getTime())
    );
  }
  function wake() {
    currentDate();
    scheduleCalendar();
  }
  function visible() {
    if (document.visibilityState === "visible") wake();
  }
  function sync(event: StorageEvent) {
    if (event.key !== key && event.key !== null) return;
    loaded = false;
    read();
    notify();
    scheduleCalendar();
  }
  function update(change: (current: DemoState) => DemoState) {
    const current = read();
    const next = change(current);
    state =
      next === current
        ? current
        : next === initial && initial.today === current.today
          ? initial
          : { ...next, today: current.today };
    try {
      // Keep the original persisted shape; the hydration date is runtime metadata.
      localStorage.setItem(
        key,
        JSON.stringify({ patients: state.patients, queue: state.queue })
      );
    } catch {
      /* Memory fallback; reload persistence is best effort. */
    }
    notify();
  }
  return {
    read,
    server: () => bootstrap,
    currentDate,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        published = state;
        window.addEventListener("storage", sync);
        window.addEventListener("focus", wake);
        window.addEventListener("pageshow", wake);
        document.addEventListener("visibilitychange", visible);
        wake();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          clearTimeout(calendarTimer);
          window.removeEventListener("storage", sync);
          window.removeEventListener("focus", wake);
          window.removeEventListener("pageshow", wake);
          document.removeEventListener("visibilitychange", visible);
        }
      };
    },
    update,
    handoff(id: string) {
      let outcome = "unavailable" as QueueHandoffOutcome;
      update((current) => {
        const result = handoffQueue(current.queue, id);
        outcome = result.outcome;
        if (result.outcome !== "sent") return current;
        const handedOffAt = new Date().toISOString();
        return {
          ...current,
          queue: result.queue.map((entry) =>
            entry.id === id
              ? { ...entry, handedOffAt, doctorOpened: false }
              : entry
          ),
        };
      });
      return outcome;
    },
    removeFromQueue(id: string) {
      update((current) => ({
        ...current,
        queue: current.queue.filter(
          (item) =>
            item.id !== id ||
            (item.status !== "waiting" && item.status !== "ready")
        ),
      }));
    },
    cancelHandoff(id: string) {
      let cancelled = false;
      update((current) => {
        const entry = current.queue.find((item) => item.id === id);
        if (
          entry?.status !== "with_doctor" ||
          !entry.handedOffAt ||
          entry.doctorOpened ||
          Date.now() - Date.parse(entry.handedOffAt) > handoffCancelMs
        )
          return current;
        cancelled = true;
        return {
          ...current,
          queue: current.queue.map((item) =>
            item.id === id
              ? { ...item, status: "ready", handedOffAt: undefined }
              : item
          ),
        };
      });
      return cancelled;
    },
    openVisit(id: string) {
      update((current) => {
        const entry = current.queue.find((item) => item.id === id);
        return entry?.status !== "with_doctor" || entry.doctorOpened
          ? current
          : {
              ...current,
              queue: current.queue.map((item) =>
                item.id === id ? { ...item, doctorOpened: true } : item
              ),
            };
      });
    },
    reset: () => update(() => browserInitial()),
  };
}
