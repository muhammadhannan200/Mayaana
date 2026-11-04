"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { createDemoStore } from "./demo-store";

export type {
  DemoPatient,
  DemoEntry,
  DemoMeal,
  DemoDay,
  DemoVisit,
} from "./demo-fixture";

const Context = createContext<ReturnType<typeof createDemoStore> | null>(null);
// Next keeps visited routes mounted. Share one browser store across providers;
// never cache mutable state across server requests.
const browserStores = new Map<string, ReturnType<typeof createDemoStore>>();
export function DemoClinicProvider({
  scope,
  children,
}: {
  scope: string;
  children: React.ReactNode;
}) {
  const store = useMemo(() => {
    if (typeof window === "undefined") return createDemoStore(scope);
    let shared = browserStores.get(scope);
    if (!shared) {
      shared = createDemoStore(scope);
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
    reset: store.reset,
    currentDate: store.currentDate,
  };
}
