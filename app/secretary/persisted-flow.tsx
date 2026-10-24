"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import * as actions from "@/app/clinical-actions";
import type {
  ClinicalFailure,
  ClinicalOperations,
  ClinicalResult,
  ClinicalSnapshot,
} from "@/lib/clinical-types";
import { ClinicFlowView } from "./clinic-flow";

const networkError: ClinicalFailure = {
  ok: false,
  kind: "network",
  message: "تعذّر الاتصال بالخدمة. احتفظ بمدخلاتك وحاول مجدداً.",
};

export function PersistedFlow({ route }: { route: string }) {
  const params = useSearchParams();
  const patient =
    params.get("patient") ??
    (route.startsWith("doctor/patients/") ? route.split("/")[2] : undefined);
  const entry =
    params.get("entry") ??
    (route.startsWith("doctor/visits/") ? route.split("/")[2] : undefined);
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [snapshot, setSnapshot] = useState<ClinicalSnapshot>();
  const [error, setError] = useState<ClinicalFailure>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const generation = useRef(0);
  const requestIds = useRef(new Map<string, string>());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const refresh = useCallback(
    (signal?: AbortSignal) => {
      const ticket = ++generation.current;
      return actions
        .getClinicScreen({ term, page, patient, entry })
        .then((result) => {
          if (signal?.aborted || ticket !== generation.current) return;
          if (result.ok) {
            setSnapshot(result.data);
            setError((current) =>
              current?.kind === "network" ? undefined : current
            );
          } else setError(result);
        })
        .catch(() => {
          if (!signal?.aborted && ticket === generation.current)
            setError(networkError);
        });
    },
    [term, page, patient, entry]
  );
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const focus = () => {
      if (!busy.current) void refresh(controller.signal);
    };
    const visible = () => {
      if (document.visibilityState === "visible") focus();
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") focus();
    }, 10_000);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  function requestId(key: string) {
    let id = requestIds.current.get(key);
    if (!id) {
      id = crypto.randomUUID();
      requestIds.current.set(key, id);
    }
    return id;
  }
  async function write(operation: () => Promise<ClinicalResult<null>>) {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setError(undefined);
    setMessage("");
    try {
      const result = await operation();
      if (!result.ok) {
        setError(result);
        return false;
      }
      setMessage("تم الحفظ في العيادة.");
      await refresh();
      return true;
    } catch {
      setError(networkError);
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const revision = (id: string) =>
    snapshot?.queue.find((row) => row.id === id)?.revision ?? -1;
  const operations: ClinicalOperations = {
    pending,
    createPatient: (input) => write(() => actions.createPatient(input)),
    enqueuePatient: (id, kind) => write(() => actions.enqueuePatient(id, kind)),
    saveMeasurements: (id, values, version) =>
      write(() =>
        actions.saveMeasurements(id, version ?? revision(id), values)
      ),
    handoffToDoctor: (id) =>
      write(() =>
        actions.handoffToDoctor(id, revision(id), requestId(`handoff:${id}`))
      ),
    saveDoctorDraft: (id, version, draft) =>
      write(() => actions.saveDoctorDraft(id, version, draft)),
    finishVisit: (id, version, draft) =>
      write(() =>
        actions.finishVisit(id, version, requestId(`finish:${id}`), draft)
      ),
    search: (value) => {
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        setTerm(value);
        setPage(0);
      }, 350);
    },
    nextPage: () => setPage((current) => current + 1),
  };
  const status = (
    <div className="clinical-status" dir="rtl" aria-live="polite">
      {pending && <p role="status">جارٍ الحفظ…</p>}
      {message && !error && (
        <p className="secretary-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <>
          <p className="secretary-error" role="alert">
            {error.message}
          </p>
          {error.kind === "auth" ? (
            <Link className="secretary-outline" href="/">
              تسجيل الدخول
            </Link>
          ) : (
            <button
              type="button"
              className="secretary-outline"
              disabled={pending}
              onClick={() => void refresh()}
            >
              تحديث البيانات / إعادة المحاولة
            </button>
          )}
          {error.kind === "conflict" && (
            <button
              type="button"
              className="secretary-outline"
              onClick={() => {
                if (
                  window.confirm(
                    "تحميل النسخة المحفوظة وإلغاء التعديلات غير المحفوظة؟"
                  )
                )
                  window.location.reload();
              }}
            >
              تحميل النسخة المحفوظة وإلغاء التعديلات
            </button>
          )}
        </>
      )}
    </div>
  );
  if (!snapshot)
    return (
      <main className="secretary-shell recovery" dir="rtl">
        <h1>العيادة</h1>
        {error ? status : <p role="status">جارٍ تحميل بيانات العيادة…</p>}
      </main>
    );
  return (
    <>
      {status}
      <ClinicFlowView
        route={route}
        clinical={snapshot}
        operations={operations}
      />
      {(snapshot.hasMore || page > 0) && (
        <div className="clinical-status" dir="rtl">
          {page > 0 && (
            <button
              className="secretary-outline"
              onClick={() => setPage((current) => current - 1)}
              disabled={pending}
            >
              الصفحة السابقة
            </button>
          )}
          {snapshot.hasMore && (
            <button
              className="secretary-outline"
              onClick={operations.nextPage}
              disabled={pending}
            >
              الصفحة التالية
            </button>
          )}
        </div>
      )}
    </>
  );
}
