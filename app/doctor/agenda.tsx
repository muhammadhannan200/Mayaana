"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { dayCountLabel } from "@/lib/arabic-count";
import {
  damascusDate,
  daysLate,
  type DoctorAgendaData,
} from "@/lib/doctor-agenda";
import "./agenda.css";
import { demoAgenda } from "@/lib/demo-agenda";
import type { DemoState } from "@/lib/demo-fixture";
import { getDoctorAgenda } from "./agenda-actions";

export function DoctorAgenda({ demoState }: { demoState?: DemoState }) {
  const demo = !!demoState;
  const [date, setDate] = useState<string>();
  const [result, setResult] =
    useState<Awaited<ReturnType<typeof getDoctorAgenda>>>();
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState({ today: false, overdue: false });
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
  const referenceDate = date ?? damascusDate(new Date());
  return (
    <>
      {(
        [
          [
            "today",
            "متوقعون اليوم",
            "لا يوجد مرضى متوقعون اليوم لم يصلوا بعد.",
          ],
          [
            "overdue",
            "متأخرون",
            "لا توجد مواعيد متأخرة دون زيارة مكتملة أو موعد لاحق.",
          ],
        ] as const
      ).map(([key, title, empty]) => {
        const rows = data?.[key] ?? [];
        const shown = expanded[key] ? rows : rows.slice(0, 3);
        return (
          <section
            className="doctor-queue agenda-section"
            key={key}
            aria-labelledby={`agenda-${key}`}
          >
            <header>
              <h2 id={`agenda-${key}`}>
                {title}
                {data && ` (${rows.length})`}
              </h2>
              {rows.length > 3 && (
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((current) => ({
                      ...current,
                      [key]: !current[key],
                    }))
                  }
                >
                  {expanded[key] ? "عرض أقل" : "عرض الكل"}
                </button>
              )}
            </header>
            {data ? (
              rows.length ? (
                <ul>
                  {shown.map((row) => (
                    <li key={row.patientId} className="agenda-row">
                      <Link
                        href={`${demo ? "/demo" : ""}/doctor/patients/${row.patientId}`}
                      >
                        <span className="patient-avatar">{row.name[0]}</span>
                        <span className="agenda-person">
                          {row.name}
                          <small>
                            موعده{" "}
                            <time dateTime={row.date}>
                              <bdi>{row.date}</bdi>
                            </time>
                          </small>
                        </span>
                        <span
                          className={
                            key === "today" ? "agenda-absent" : "agenda-late"
                          }
                        >
                          {key === "today"
                            ? "لم يصل بعد"
                            : `متأخر ${dayCountLabel(daysLate(referenceDate, row.date))}`}
                        </span>
                      </Link>
                      {key === "overdue" && row.phone && (
                        <a
                          className="agenda-call"
                          href={`tel:${row.phone}`}
                          aria-label={`اتصال بـ ${row.name}`}
                        >
                          <Icon name="phone" size={18} />
                        </a>
                      )}
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
        );
      })}
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
