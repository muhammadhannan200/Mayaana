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
                ["waiting", "ready", "with_doctor", "completed"].includes(
                  e.status
                ) &&
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
  return {
    ...state,
    update: store.update,
    reset: () => store.update(() => initial),
  };
}
