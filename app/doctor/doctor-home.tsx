import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { SignOutForm } from "@/app/sign-out-form";
import type { PatientRecord, QueueEntry } from "@/lib/clinical-model";
import type { DemoState } from "@/lib/demo-fixture";
import { DoctorAgenda } from "./agenda";
import { DoctorWeekStats } from "./doctor-week";

export function DoctorHome({
  demo,
  current,
  waiting,
  completed,
  findPatient,
  href,
  agendaState,
  demoToday,
  children,
}: {
  demo: boolean;
  current: QueueEntry[];
  waiting: QueueEntry[];
  completed: QueueEntry[];
  findPatient: (entry: QueueEntry) => PatientRecord;
  href: (route: string) => string;
  agendaState?: DemoState;
  demoToday?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <header className="doctor-home-header">
        <div>
          <h1>{demo ? "صباح الخير دكتور" : "دور العيادة"}</h1>
          <p>دور اليوم</p>
        </div>
        {!demo && (
          <SignOutForm buttonClassName="doctor-bell">
            <Icon name="account" />
          </SignOutForm>
        )}
      </header>
      <div className="doctor-content">
        {current.length > 1 && (
          <p className="secretary-error" role="alert">
            توجد زيارات نشطة متعارضة من بيانات سابقة. أكمل الزيارة الحالية لتظهر
            الزيارة التالية.
          </p>
        )}
        {current[0] && (
          <section className="doctor-current">
            <p className="doctor-current-label">
              <Image
                src="/rashaqa/doctor-door.svg"
                width={18}
                height={18}
                alt=""
                unoptimized
              />
              عندك الآن
            </p>
            <div className="doctor-current-summary">
              <h2>{findPatient(current[0]).name}</h2>
              <p>
                {current[0].kind === "full_exam" ? "كشفية" : "مراجعة"} · الزيارة{" "}
                {findPatient(current[0]).visits.length + 1}
                {current[0].measurements.weight && (
                  <>
                    {" "}
                    · الوزن <bdi>{current[0].measurements.weight} كغ</bdi>
                  </>
                )}
              </p>
            </div>
            <Link href={href(`doctor/patients/${current[0].patientId}`)}>
              فتح الملف
            </Link>
          </section>
        )}
        <DoctorWeekStats
          demoState={agendaState}
          demoToday={demoToday}
          href={href("doctor/week")}
        />
        {!current[0] && (
          <p className="doctor-empty">لا يوجد مريض عند الطبيب الآن.</p>
        )}
        <section className="doctor-queue">
          <h2>الدور برّا ({waiting.length})</h2>
          <ol>
            {waiting.map((e, i) => (
              <li key={e.id}>
                <span className="doctor-order">{i + 1}</span>
                <span className="doctor-queue-person">
                  {findPatient(e).name}
                  <small>
                    {e.kind === "full_exam" ? "كشفية" : "مراجعة"}
                    {e.arrivalTime && (
                      <>
                        {" "}
                        · وصل <bdi>{e.arrivalTime}</bdi>
                      </>
                    )}
                  </small>
                </span>
                <span
                  className={
                    e.status === "ready" ? "doctor-ready" : "doctor-waiting"
                  }
                >
                  {e.status === "ready" ? (
                    <Icon name="check" size={14} />
                  ) : (
                    <span className="doctor-clock" aria-hidden="true" />
                  )}
                  {e.status === "ready" ? "جاهز للدخول" : "بانتظار القياس"}
                </span>
              </li>
            ))}
          </ol>
        </section>
        {completed.length > 0 && (
          <section className="doctor-queue">
            <h2>الزيارات المكتملة ({completed.length})</h2>
            <ul>
              {completed.map((e) => (
                <li key={e.id}>
                  <Link href={href(`doctor/visits/${e.id}`)}>
                    <span>{findPatient(e).name}</span>
                    <span className="doctor-ready">اكتملت الزيارة</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <DoctorAgenda demoState={agendaState} />
        {children}
      </div>
    </>
  );
}
