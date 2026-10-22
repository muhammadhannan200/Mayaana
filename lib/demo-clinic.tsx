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
  status: "waiting" | "ready" | "with_doctor";
  measurements: VisitMeasurement;
};
type State = { patients: DemoPatient[]; queue: DemoEntry[] };
const initial: State = {
  patients: [
    {
      id: "demo-reem",
      name: "ريم الخطيب",
      phone: "0954312134",
      height: "165",
      gender: "female",
      birthYear: "1990",
      goal: "نقص وزن",
      visits: followUpFixture.visits,
    },
    {
      id: "demo-samer",
      name: "سامر خالد الحلبي",
      phone: "0954312135",
      height: "178",
      gender: "male",
      birthYear: "1985",
      goal: "نقص وزن",
      visits: [],
    },
    {
      id: "demo-samer-2",
      name: "سامر يوسف",
      phone: "0954312136",
      height: "175",
      gender: "male",
      birthYear: "1992",
      goal: "زيادة وزن",
      visits: [],
    },
  ],
  queue: [],
};

// Deliberately browser-only, versioned and isolated from real patient tables.
function createStore(scope: string) {
  const key = `mayanaa-demo-v1:${scope}`;
  let state = initial;
  let loaded = false;
  const listeners = new Set<() => void>();
  function read() {
    if (!loaded && typeof window !== "undefined") {
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
                ["waiting", "ready", "with_doctor"].includes(e.status) &&
                e.measurements
            )
          )
            state = parsed;
        }
      } catch {
        /* Unavailable or stale storage: keep the functional in-memory demo. */
      }
    }
    return state;
  }
  return {
    read,
    server: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      const sync = (event: StorageEvent) => {
        if (event.key !== key && event.key !== null) return;
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
      state = change(read());
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* Memory fallback; reload persistence is best effort. */
      }
      listeners.forEach((fn) => fn());
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
  return { ...state, update: store.update };
}
