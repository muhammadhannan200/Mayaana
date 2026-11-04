"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import type { DemoState } from "@/lib/demo-fixture";
import {
  countWeekKinds,
  demoWeek,
  groupWeekVisits,
  type DoctorWeekData,
} from "@/lib/doctor-week";
import { VisitType } from "@/app/secretary/clinic-ui";
import { getDoctorWeek } from "./agenda-actions";
import "./doctor-week.css";

function useDoctorWeek(demoState?: DemoState, demoToday = "") {
  const [data, setData] = useState<DoctorWeekData>();
  const [failed, setFailed] = useState(false);
  const demo = !!demoState;
  useEffect(() => {
    if (demo) return;
    let live = true;
    getDoctorWeek()
      .then((result) => {
        if (!live) return;
        if (result.ok) setData(result.data);
        else setFailed(true);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [demo]);
  return {
    data: demoState ? demoWeek(demoState, demoToday) : data,
    failed,
  };
}

export function DoctorWeekStats({
  demoState,
  demoToday,
  href,
}: {
  demoState?: DemoState;
  demoToday?: string;
  href: string;
}) {
  const { data, failed } = useDoctorWeek(demoState, demoToday);
  const counts = data && countWeekKinds(data.visits);
  const value = (number?: number) => (failed ? "—" : (number ?? "…"));
  return (
    <div className="doctor-stats">
      <Link href={href} aria-label="عرض مرضى هذا الأسبوع">
        <strong>{value(data?.visits.length)}</strong>
        <span>مرضى هذا الأسبوع</span>
        <small>
          {counts
            ? `${counts.fullExam} كشفية · ${counts.followUp} مراجعة`
            : "آخر 7 أيام"}
        </small>
      </Link>
      <div>
        <strong>{value(data?.totalPatients)}</strong>
        <span>إجمالي المرضى</span>
        <small>كل الملفات</small>
      </div>
    </div>
  );
}

const filters = [
  { id: "all", label: "الكل" },
  { id: "full_exam", label: "كشفية" },
  { id: "follow_up", label: "مراجعة" },
] as const;

export function DoctorWeek({
  demoState,
  demoToday,
  href,
}: {
  demoState?: DemoState;
  demoToday?: string;
  href: (route: string) => string;
}) {
  const { data, failed } = useDoctorWeek(demoState, demoToday);
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const visits = data?.visits ?? [];
  const counts = countWeekKinds(visits);
  const count = {
    all: visits.length,
    full_exam: counts.fullExam,
    follow_up: counts.followUp,
  };
  const groups = groupWeekVisits(
    filter === "all" ? visits : visits.filter((v) => v.kind === filter)
  );
  return (
    <div className="doctor-week">
      <div
        className="doctor-week-filters"
        role="group"
        aria-label="نوع الزيارة"
      >
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label} ({count[item.id]})
          </button>
        ))}
      </div>
      {failed ? (
        <p className="doctor-empty">تعذّر تحميل زيارات الأسبوع.</p>
      ) : !data ? (
        <p className="doctor-empty">جارٍ التحميل…</p>
      ) : !groups.length ? (
        <p className="doctor-empty">لا توجد زيارات في هذا الأسبوع.</p>
      ) : (
        groups.map((group) => (
          <section key={group.date}>
            <h2>
              <bdi>{group.date}</bdi>
            </h2>
            <ul>
              {group.rows.map((visit) => (
                <li key={visit.id}>
                  <Link href={href(`doctor/patients/${visit.patientId}`)}>
                    <span className="patient-avatar">{visit.name[0]}</span>
                    <span className="doctor-week-person">
                      <strong>{visit.name}</strong>
                      {visit.arrivalTime && (
                        <small>
                          وصل <bdi>{visit.arrivalTime}</bdi>
                        </small>
                      )}
                    </span>
                    <VisitType kind={visit.kind} />
                    <Icon name="arrow" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
