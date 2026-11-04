import type { ClinicalSnapshot } from "./clinical-types";

// In-memory only, so moving between pages shows data at once while it refreshes.
// Never persisted, and cleared on sign out.
let cached: ClinicalSnapshot | undefined;

export function readCachedSnapshot(
  role: string,
  entry?: string,
  patient?: string
) {
  if (
    !cached ||
    cached.role !== role ||
    (entry && !cached.queue.some((row) => row.id === entry)) ||
    (patient && !cached.patients.some((row) => row.id === patient))
  )
    return undefined;
  return cached;
}

export function writeCachedSnapshot(snapshot: ClinicalSnapshot) {
  cached = snapshot;
}

export function clearCachedSnapshot() {
  cached = undefined;
}
