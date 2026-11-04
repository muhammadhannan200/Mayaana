"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  followUpFixture,
  type MockVisit,
  type VisitMeasurement,
} from "@/app/secretary/measurements/mock-visits";
import { handoffQueue, type QueueHandoffOutcome } from "./queue-handoff";

type DemoHandoffOutcome =
  QueueHandoffOutcome | "unsupported" | "storage_unavailable";
type DemoVisitSaveOutcome = "saved" | "local_only" | "conflict" | "unavailable";
type DemoCompletionOutcome =
  | "completed"
  | "conflict"
  | "validation"
  | "unavailable"
  | "storage_unavailable";

export type DemoPatient = {
  id: string;
  name: string;
  phone: string;
  height: string;
  gender: string;
  birthYear: string;
  goal: string;
  visits: MockVisit[];
};
export type DemoEntry = {
  id: string;
  patientId: string;
  kind: "follow_up" | "full_exam";
  status: "waiting" | "ready" | "with_doctor" | "completed";
  measurements: VisitMeasurement;
  arrivalTime?: string;
  visit?: DemoVisit;
};
export type DemoMeal = { id: string; type: string; description: string };
export type DemoDay = { id: string; meals: DemoMeal[] };
export type DemoVisit = {
  notes: string;
  days: DemoDay[];
  appointment: string;
  completedAt?: string;
};
type State = { patients: DemoPatient[]; queue: DemoEntry[] };
// Entirely fictional clinic day. Reserved example phone numbers are not contacts.
function demoDate(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function history(
  id: string,
  weight: string,
  waist: string,
  muscle = "25.8"
): MockVisit[] {
  return [
    {
      id: `${id}-previous`,
      number: 1,
      date: demoDate(-14),
      detailDate: `${demoDate(-14)} · 10:30 ص · زيارة خيالية`,
      kind: "full_exam",
      starting: true,
      measurements: {
        weight,
        waist,
        fat: "32.4",
        muscle,
        visceral: "9",
        bmr: "1450",
        arm: "29",
        thigh: "55",
        hip: "102",
      },
    },
  ];
}
const featuredPlan: DemoDay[] = [
  {
    id: "fictional-day-1",
    meals: [
      {
        id: "fictional-breakfast",
        type: "فطور",
        description: "بيضتان مسلوقتان، خبز أسمر وخيار",
      },
      {
        id: "fictional-snack-1",
        type: "سناك",
        description: "تفاحة و١٠ حبات لوز",
      },
      {
        id: "fictional-lunch",
        type: "غداء",
        description: "١٥٠ غ دجاج مشوي، نصف كوب أرز وسلطة",
      },
      {
        id: "fictional-snack-2",
        type: "سناك",
        description: "كوب لبن قليل الدسم",
      },
      {
        id: "fictional-dinner",
        type: "عشاء",
        description: "لبنة قليلة الدسم، خبز أسمر وخضار",
      },
    ],
  },
];
const initial: State = {
  patients: [
    {
      id: "demo-reem",
      name: "ريم الخطيب",
      phone: "+12025550101",
      height: "165",
      gender: "female",
      birthYear: "1990",
      goal: "نقص وزن",
      visits: followUpFixture.visits,
    },
    {
      id: "demo-samer",
      name: "سامر درويش",
      phone: "+12025550102",
      height: "178",
      gender: "male",
      birthYear: "1985",
      goal: "نقص وزن",
      visits: history("demo-samer", "88.6", "98", "33.8"),
    },
    {
      id: "demo-ahmad",
      name: "أحمد الخطيب",
      phone: "+12025550103",
      height: "180",
      gender: "male",
      birthYear: "1992",
      goal: "نقص وزن",
      visits: [],
    },
    {
      id: "demo-layan",
      name: "ليان منصور",
      phone: "+12025550104",
      height: "163",
      gender: "female",
      birthYear: "1998",
      goal: "نقص وزن",
      visits: [],
    },
    {
      id: "demo-noor",
      name: "نور الحسن",
      phone: "+12025550105",
      height: "165",
      gender: "female",
      birthYear: "1994",
      goal: "نقص وزن",
      visits: history("demo-noor", "76.4", "88"),
    },
    {
      id: "demo-maryam",
      name: "مريم العلي",
      phone: "+12025550106",
      height: "168",
      gender: "female",
      birthYear: "1989",
      goal: "نقص وزن",
      visits: [
        {
          id: "demo-completed",
          number: 2,
          date: demoDate(0),
          detailDate: `${demoDate(0)} · 09:15 ص · زيارة خيالية مكتملة`,
          kind: "follow_up",
          measurements: {
            weight: "71.2",
            waist: "82",
            fat: "30.1",
            muscle: "25.4",
          },
        },
        ...history("demo-maryam", "72.6", "84"),
      ],
    },
  ],
  queue: [
    {
      id: "demo-waiting",
      patientId: "demo-ahmad",
      kind: "full_exam",
      status: "waiting",
      arrivalTime: "10:00",
      measurements: {},
    },
    {
      id: "demo-pending",
      patientId: "demo-layan",
      kind: "full_exam",
      status: "waiting",
      arrivalTime: "09:50",
      measurements: { weight: "68.3", waist: "81" },
    },
    {
      id: "demo-ready",
      patientId: "demo-samer",
      kind: "follow_up",
      status: "ready",
      arrivalTime: "09:40",
      measurements: {
        weight: "86.9",
        waist: "95",
        fat: "28.5",
        muscle: "34.2",
        visceral: "10",
        bmr: "1780",
        arm: "32",
        thigh: "53",
        hip: "104",
      },
      visit: {
        notes: "تحسن الالتزام بالمشي. الاستمرار بتخفيف المشروبات المحلاة.",
        days: [],
        appointment: demoDate(14),
      },
    },
    {
      id: "demo-featured",
      patientId: "demo-noor",
      kind: "follow_up",
      status: "with_doctor",
      arrivalTime: "09:25",
      measurements: {
        weight: "74.8",
        waist: "86",
        fat: "31.2",
        muscle: "26.1",
        visceral: "8",
        bmr: "1460",
        arm: "28",
        thigh: "54",
        hip: "101",
      },
      visit: {
        notes:
          "نزول تدريجي جيد. شرب الماء والمشي ٣٠ دقيقة يومياً. نموذج يوم غذائي خيالي، وليس وصفة علاجية.",
        days: featuredPlan,
        appointment: demoDate(14),
      },
    },
    {
      id: "demo-completed",
      patientId: "demo-maryam",
      kind: "follow_up",
      status: "completed",
      arrivalTime: "09:00",
      measurements: {
        weight: "71.2",
        waist: "82",
        fat: "30.1",
        muscle: "25.4",
      },
      visit: {
        notes: "تحسن القياسات. الاستمرار بوجبات منتظمة ونشاط خفيف.",
        days: featuredPlan,
        appointment: demoDate(14),
        completedAt: `${demoDate(0)}T09:15:00`,
      },
    },
  ],
};

// Deliberately browser-only, versioned and isolated from real patient tables.
function createStore(scope: string) {
  const key = `mayanaa-demo-v1:${scope}`;
  const draftPrefix = `mayanaa-demo-visit-v1:${scope}:`;
  let state = initial;
  let loaded = false;
  // Sticky for this store lifetime. Never flush a disconnected snapshot on
  // recovery: another tab may have committed a handoff while we were isolated.
  // A reload creates a new store and reads disk, abandoning fallback queue edits.
  let memoryOnly = false;
  const listeners = new Set<() => void>();
  const localDrafts = new Map<string, { visit: DemoVisit; saving: boolean }>();
  function overlayLocalDrafts() {
    let changed = false;
    const queue = state.queue.map((entry) => {
      const local = localDrafts.get(entry.id);
      if (!local || entry.status !== "with_doctor" || entry.visit === local.visit)
        return entry;
      changed = true;
      return { ...entry, visit: local.visit };
    });
    if (changed) state = { ...state, queue };
  }
  function read(includeLocal = true) {
    if (!loaded && typeof window !== "undefined" && !memoryOnly) {
      loaded = true;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as State;
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
            state = parsed;
        } else state = initial;
        // Drafts have separate keys so note autosave cannot
        // overwrite a concurrently committed queue transition or completion.
        state = {
          ...state,
          queue: state.queue.map((entry) => {
            if (entry.status !== "with_doctor") return entry;
            const raw = localStorage.getItem(`${draftPrefix}${entry.id}`);
            if (!raw) return entry;
            const visit = JSON.parse(raw) as DemoVisit;
            return typeof visit.notes === "string" &&
              Array.isArray(visit.days) &&
              typeof visit.appointment === "string"
              ? { ...entry, visit }
              : entry;
          }),
        };
      } catch {
        memoryOnly = true;
        /* Keep in-memory edits rather than re-reading stale disk data. */
      }
    }
    if (includeLocal) overlayLocalDrafts();
    return state;
  }
  async function mutate<T>(
    change: (current: State) => { next: State; result: T },
    requireStorage = false,
    persistState = true
  ): Promise<T> {
    const apply = (locked: boolean) => {
      if (!locked) memoryOnly = true;
      // A storage event can arrive after a competing tab acquires the lock.
      // Re-read under the lock before queue writes, including completion/reset.
      loaded = false;
      const current = read(false);
      if (requireStorage && memoryOnly)
        throw new Error("Demo storage unavailable");
      const { next, result } = change(current);
      if (persistState && next !== current && !memoryOnly) {
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          memoryOnly = true;
          if (requireStorage) throw new Error("Demo storage unavailable");
          /* Other edits retain the best-effort memory fallback. */
        }
      }
      state = next;
      overlayLocalDrafts();
      listeners.forEach((fn) => fn());
      return result;
    };
    // Even non-handoff whole-store writes require the lock. If acquiring it
    // fails, retain best-effort edits in this tab only; never publish them later.
    let entered = false;
    try {
      if (navigator.locks)
        return await navigator.locks.request(key, () => {
          entered = true;
          return apply(true);
        });
    } catch (error) {
      // Do not replay a callback that ran and failed (including storage writes).
      if (entered || requireStorage) throw error;
    }
    return apply(false);
  }
  return {
    read,
    // Browser-local data (including relative seed dates) is not a server
    // snapshot. Use the same loading state on the server and first hydration
    // render, even across midnight, time zones or a long-lived server module.
    server: () => null,
    subscribe(listener: () => void) {
      listeners.add(listener);
      const sync = (event: StorageEvent) => {
        if (memoryOnly) return;
        if (
          event.key !== key &&
          event.key !== null &&
          !event.key.startsWith(draftPrefix)
        )
          return;
        loaded = false;
        state = initial;
        read();
        listeners.forEach((fn) => fn());
      };
      window.addEventListener("storage", sync);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", sync);
      };
    },
    update(change: (current: State) => State) {
      return mutate((current) => ({
        next: change(current),
        result: undefined,
      }));
    },
    localDraft(id: string) {
      return localDrafts.get(id)?.visit;
    },
    isSavingVisit(id: string) {
      return localDrafts.get(id)?.saving ?? false;
    },
    async saveVisit(
      id: string,
      change: (visit: DemoVisit) => DemoVisit,
      expected: DemoVisit
    ): Promise<DemoVisitSaveOutcome> {
      // Capture input synchronously, but never publish it without the queue's
      // lock. The local overlay keeps rapid typing responsive while it waits.
      const base = JSON.stringify(expected);
      const local = {
        visit: structuredClone(change(structuredClone(expected))),
        saving: true,
      };
      localDrafts.set(id, local);
      overlayLocalDrafts();
      listeners.forEach((fn) => fn());
      const result = await mutate<DemoVisitSaveOutcome>((current) => {
        const entry = current.queue.find((item) => item.id === id);
        if (entry?.status !== "with_doctor")
          return { next: current, result: "unavailable" };
        const visit = entry.visit ?? { notes: "", days: [], appointment: "" };
        if (JSON.stringify(visit) !== base) {
          memoryOnly = true;
          return { next: current, result: "conflict" };
        }
        try {
          localStorage.setItem(`${draftPrefix}${id}`, JSON.stringify(local.visit));
        } catch (error) {
          // Isolate before releasing the lock, not in a later promise handler.
          memoryOnly = true;
          throw error;
        }
        return {
          next: {
            ...current,
            queue: current.queue.map((item) =>
              item.id === id ? { ...item, visit: local.visit } : item
            ),
          },
          result: "saved",
        };
      }, true, false).catch(() => {
        memoryOnly = true;
        return "local_only" as const;
      });
      if (localDrafts.get(id) === local) {
        if (result === "saved") localDrafts.delete(id);
        else local.saving = false;
      }
      overlayLocalDrafts();
      // Runtime pending/recovery metadata changed, not the persisted schema.
      state = { ...state };
      listeners.forEach((fn) => fn());
      return result;
    },
    completeVisit(
      id: string,
      expected: DemoVisit,
      appointment: string
    ): Promise<DemoCompletionOutcome> {
      if (!navigator.locks) return Promise.resolve("storage_unavailable");
      const base = JSON.stringify(expected);
      return mutate<DemoCompletionOutcome>((current) => {
        const active = current.queue.find((entry) => entry.id === id);
        if (active?.status !== "with_doctor")
          return { next: current, result: "unavailable" };
        const visit = active.visit ?? { notes: "", days: [], appointment: "" };
        // The lock may have been queued while another tab autosaved this visit.
        // Compare after the authoritative reread; never complete captured data.
        if (JSON.stringify(visit) !== base)
          return { next: current, result: "conflict" };
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        if (
          !visit.days.length ||
          visit.days.some((day) => !day.meals.length) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(appointment) ||
          appointment <= today
        )
          return { next: current, result: "validation" };
        const completedAt = now.toISOString();
        return {
          result: "completed",
          next: {
            ...current,
            queue: current.queue.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    status: "completed",
                    visit: { ...visit, appointment, completedAt },
                  }
                : entry
            ),
            patients: current.patients.map((patient) =>
              patient.id === active.patientId
                ? {
                    ...patient,
                    visits: [
                      {
                        id,
                        number: patient.visits.length + 1,
                        date: now.toLocaleDateString("ar-SY"),
                        detailDate: "زيارة مكتملة · العرض التجريبي",
                        kind: active.kind,
                        measurements: { ...active.measurements },
                      },
                      ...patient.visits,
                    ],
                  }
                : patient
            ),
          },
        };
      }, true).catch(() => "storage_unavailable" as const);
    },
    async reset(): Promise<"reset" | "local_only"> {
      await mutate(() => {
        localDrafts.clear();
        try {
          if (!memoryOnly)
            for (const draftKey of Object.keys(localStorage))
              if (draftKey.startsWith(draftPrefix))
                localStorage.removeItem(draftKey);
        } catch {
          // Cleanup may be partial. Never publish a fresh seed while surviving
          // draft keys could attach to it; keep this reset isolated until reload.
          memoryOnly = true;
        }
        return { next: initial, result: undefined };
      });
      // mutate also isolates failed main-document writes and unavailable locks.
      return memoryOnly ? "local_only" : "reset";
    },
    handoff(id: string): Promise<DemoHandoffOutcome> {
      // Do not pretend cross-tab atomicity is available on insecure/old browsers.
      if (!navigator.locks) return Promise.resolve("unsupported");
      return mutate((current) => {
        const { queue, outcome } = handoffQueue(current.queue, id);
        return {
          next: queue === current.queue ? current : { ...current, queue },
          result: outcome,
        };
      }, true).catch(() => "storage_unavailable" as const);
    },
  };
}
const Context = createContext<ReturnType<typeof createStore> | null>(null);
// Next keeps visited routes mounted. Share one browser store across their providers;
// never cache mutable state across server requests.
const browserStores = new Map<string, ReturnType<typeof createStore>>();
export function DemoClinicProvider({
  scope,
  children,
}: {
  scope: string;
  children: React.ReactNode;
}) {
  const store = useMemo(() => {
    if (typeof window === "undefined") return createStore(scope);
    let shared = browserStores.get(scope);
    if (!shared) {
      shared = createStore(scope);
      browserStores.set(scope, shared);
    }
    return shared;
  }, [scope]);
  return <Context value={store}>{children}</Context>;
}
export function useDemoClinic() {
  const store = useContext(Context);
  if (!store) throw new Error("DemoClinicProvider is required");
  const state = useSyncExternalStore(store.subscribe, store.read, store.server);
  return {
    ...(state ?? { patients: [], queue: [] }),
    ready: state !== null,
    update: store.update,
    handoff: store.handoff,
    saveVisit: store.saveVisit,
    localDraft: store.localDraft,
    isSavingVisit: store.isSavingVisit,
    completeVisit: store.completeVisit,
    reset: store.reset,
  };
}
