"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { damascusDate, type DoctorAgendaData } from "@/lib/doctor-agenda";
import { demoAgenda } from "@/lib/demo-agenda";
import type { DemoState } from "@/lib/demo-fixture";
import { getDoctorAgenda } from "./agenda-actions";

export function DoctorAgenda({ demoState }: { demoState?: DemoState }) {
  const demo = !!demoState;
  const [date, setDate] = useState<string>();
  const [result, setResult] =
    useState<Awaited<ReturnType<typeof getDoctorAgenda>>>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    let pending = false;
    async function refresh() {
      if (pending || document.visibilityState !== "visible") return;
      if (demo) {
        setDate(damascusDate(new Date()));
        return;
      }
      pending = true;
      try {
        const next = await getDoctorAgenda();
        if (live) setResult(next);
      } catch {
        if (live)
          setResult({
            ok: false,
            message: "تعذّر تحميل المواعيد. أعد المحاولة.",
          });
      } finally {
        pending = false;
      }
    }
    void refresh();
    const wake = () => void refresh();
    const timer = setInterval(wake, 10_000);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [demo, retry]);
  const data: DoctorAgendaData | undefined = demoState
    ? date
      ? demoAgenda(demoState, date)
      : undefined
    : result?.ok
      ? result.data
      : undefined;
  return (
    <>
      {(
        [
          ["today", "متوقع اليوم", "لا يوجد مرضى متوقعون اليوم لم يصلوا بعد."],
          [
            "overdue",
            "متأخر",
            "لا توجد مواعيد متأخرة دون زيارة مكتملة أو موعد لاحق.",
          ],
        ] as const
      ).map(([key, title, empty]) => (
        <section
          className="doctor-queue"
          key={key}
          aria-labelledby={`agenda-${key}`}
        >
          <h2 id={`agenda-${key}`}>
            {title}
            {data && ` (${data[key].length})`}
          </h2>
          {data ? (
            data[key].length ? (
              <ul>
                {data[key].map((row) => (
                  <li key={row.patientId}>
                    <Link
                      href={`${demo ? "/demo" : ""}/doctor/patients/${row.patientId}`}
                    >
                      <span>
                        {row.name}
                        <small>
                          الموعد:{" "}
                          <time dateTime={row.date}>
                            <bdi>{row.date}</bdi>
                          </time>
                        </small>
                      </span>
                      <span className="doctor-ready">فتح الملف</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="doctor-empty">{empty}</p>
            )
          ) : (
            <p className="doctor-empty">
              {result && !result.ok
                ? "المواعيد غير متاحة حالياً."
                : "جارٍ تحميل المواعيد…"}
            </p>
          )}
        </section>
      ))}
      {result && !result.ok && !demo && (
        <div role="alert">
          <p className="secretary-error">{result.message}</p>
          <button
            type="button"
            className="secretary-outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            إعادة تحميل المواعيد
          </button>
        </div>
      )}
    </>
  );
}
