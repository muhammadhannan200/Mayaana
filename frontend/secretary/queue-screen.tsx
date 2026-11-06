"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/frontend/components/icon";
import { NotificationBell } from "@/frontend/components/notification-bell";
import { Toast } from "@/frontend/components/toast";
import type { useDemoClinic } from "@/frontend/demo/demo-clinic";
import { longDate } from "@/shared/clinic-dates";
import type { clinicNotifications } from "@/shared/clinic-notifications";
import type { PatientRecord, QueueEntry } from "@/shared/clinical-model";
import type { ClinicalOperations } from "@/shared/clinical-types";
import {
  cancelUnavailableMessage,
  doctorAvailableMessage,
  doctorBusyMessage,
  doctorOccupiedMessage,
  handoffCancelMs,
} from "@/shared/queue-handoff";
import { DemoNote } from "./clinic-ui";
import { QueuePatientCard } from "./queue-patient-card";

// The message shown after another screen sends the secretary back to the queue.
export function queueToastText(params: URLSearchParams, selectedName?: string) {
  return params.has("sent")
    ? "تم إدخال المريض عند الطبيب."
    : params.has("measured")
      ? "تم حفظ القياسات. المريض جاهز للدخول."
      : params.has("added")
        ? selectedName
          ? `أضيف ${selectedName} للدور · ${
              params.get("kind") === "full_exam" ? "كشفية" : "مراجعة"
            }`
          : "تمت إضافة المريض للدور."
        : "";
}

type QueueScreenProps = {
  demo?: boolean;
  queue: QueueEntry[];
  waiting: QueueEntry[];
  current: QueueEntry[];
  completed: QueueEntry[];
  notifications: ReturnType<typeof clinicNotifications>;
  queueToast?: string;
  error: string;
  setError: (message: string) => void;
  operations?: ClinicalOperations;
  local?: ReturnType<typeof useDemoClinic>;
  href: (path: string) => string;
  go: (path: string) => void;
  findPatient: (entry: QueueEntry) => PatientRecord;
  badge: (entry: QueueEntry) => ReactNode;
};

export function QueueScreen({
  demo = false,

  queue,
  waiting,
  current,
  completed,
  notifications,
  queueToast,
  error,
  setError,
  operations,
  local,
  href,
  go,
  findPatient,
  badge,
}: QueueScreenProps) {
  const [removedToast, setRemovedToast] = useState("");
  return (
    <>
      <header className="secretary-header">
        <div>
          <h1>دور اليوم</h1>
          <p>
            {longDate(
              local?.today ? new Date(`${local.today}T12:00:00Z`) : undefined
            )}
          </p>
        </div>
        <NotificationBell
          items={notifications}
          scope="secretary"
          className="secretary-bell"
        />
      </header>
      <div className="secretary-content">
        {error && (
          <p className="secretary-error" role="alert">
            {error}
          </p>
        )}
        {current[0] ? (
          <p className="intake-info" role="status">
            {doctorBusyMessage(findPatient(current[0]).name)}
          </p>
        ) : (
          completed.length > 0 && (
            <p className="intake-info" role="status">
              {doctorAvailableMessage}
            </p>
          )
        )}
        {queueToast && <Toast key={queueToast} message={queueToast} />}
        {removedToast && (
          <Toast
            key={removedToast}
            message={`تمت إزالة ${removedToast} من الدور.`}
          />
        )}
        <div className="queue-totals">
          <div>
            <strong>{waiting.length}</strong>
            <span>بالانتظار</span>
          </div>
          <div>
            <strong>{current.length}</strong>
            <span>عند الطبيب</span>
          </div>
          <div>
            <strong>{completed.length}</strong>
            <span>انتهت</span>
          </div>
        </div>
        {current.length > 0 && (
          <section className="queue-section">
            <h2>عند الطبيب ({current.length})</h2>
            <ul className="queue-list">
              {current.map((e) => (
                <li key={e.id} className="queue-card doctor-card">
                  <strong>{findPatient(e).name}</strong>
                  <span className="queue-status">عند الطبيب</span>
                  <CancelHandoff
                    entry={e}
                    disabled={operations?.pending}
                    onCancel={async () => {
                      setError("");
                      if (operations) {
                        await operations.cancelHandoff(e.id);
                        return;
                      }
                      if (!local!.cancelHandoff(e.id))
                        setError(cancelUnavailableMessage);
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="queue-section">
          <h2>بالانتظار الآن ({waiting.length})</h2>
          {waiting.length ? (
            <ol className="queue-list">
              {waiting.map((e, i) => (
                <QueuePatientCard
                  key={e.id}
                  patientName={findPatient(e).name}
                  queueNumber={i + 1}
                  pending={operations?.pending}
                  onRemove={async (reason) => {
                    setError("");
                    if (operations) {
                      const removed = await operations.removeFromQueue(
                        e.id,
                        reason
                      );
                      if (removed) setRemovedToast(findPatient(e).name);
                      return removed;
                    }
                    setRemovedToast(findPatient(e).name);
                    local!.removeFromQueue(e.id);
                    return true;
                  }}
                >
                  <div className="queue-card-top">
                    <span className="queue-number">
                      <small>دور</small>
                      {i + 1}
                    </span>
                    <div className="queue-person">
                      <strong>{findPatient(e).name}</strong>
                      <span>
                        {e.arrivalTime && (
                          <>
                            {findPatient(e).gender === "female"
                              ? "وصلت"
                              : "وصل"}{" "}
                            <bdi>{e.arrivalTime}</bdi> ·{" "}
                          </>
                        )}
                        الزيارة {findPatient(e).visits.length + 1}
                      </span>
                      {e.status === "waiting" &&
                        Object.keys(e.measurements).length > 0 && (
                          <span>القياسات غير مكتملة</span>
                        )}
                    </div>
                    {badge(e)}
                  </div>
                  <div className="queue-card-actions">
                    {e.status === "ready" ? (
                      <>
                        <button
                          className="secretary-primary"
                          disabled={operations?.pending}
                          onClick={async () => {
                            setError("");
                            // The server decides: this snapshot can be up to
                            // ten seconds behind a visit that just finished.
                            if (operations) {
                              if (await operations.handoffToDoctor(e.id))
                                go("secretary?sent=1");
                              return;
                            }
                            if (local!.handoff(e.id) === "occupied")
                              setError(
                                current[0]
                                  ? doctorBusyMessage(
                                      findPatient(current[0]).name
                                    )
                                  : doctorOccupiedMessage
                              );
                            else go("secretary?sent=1");
                          }}
                        >
                          إدخال عند الطبيب
                        </button>
                        <Link
                          className="queue-edit"
                          href={href(
                            `secretary/measurements/${e.kind === "full_exam" ? "full-exam" : "follow-up"}?entry=${e.id}`
                          )}
                        >
                          تعديل القياسات
                        </Link>
                      </>
                    ) : (
                      <Link
                        className="secretary-outline"
                        href={href(
                          `secretary/measurements/${e.kind === "full_exam" ? "full-exam" : "follow-up"}?entry=${e.id}`
                        )}
                      >
                        <Icon name="scale" size={18} />
                        أخذ القياس
                      </Link>
                    )}
                  </div>
                </QueuePatientCard>
              ))}
            </ol>
          ) : (
            <div className="queue-empty">
              <span className="queue-empty-icon">
                <Icon name="queue" size={32} />
              </span>
              <h3>الدور فارغ الآن</h3>
              <p>أضف مريضاً لبدء دور اليوم.</p>
              <Link className="secretary-primary" href={href("secretary/add")}>
                إضافة مريض للدور
              </Link>
            </div>
          )}
        </section>
        {completed.length > 0 && (
          <section className="queue-section">
            <h2>انتهت ({completed.length})</h2>
            <ul className="queue-list">
              {completed.map((e) => (
                <li key={e.id} className="queue-card doctor-card">
                  <strong>{findPatient(e).name}</strong>
                  <span className="queue-status">اكتملت الزيارة</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <DemoNote demo={demo} href={href("doctor")} />
      </div>
      {queue.length > 0 && (
        <Link className="queue-fab" href={href("secretary/add")}>
          <Icon name="plus" size={20} />
          إضافة للدور
        </Link>
      )}
    </>
  );
}

// Display only: the database enforces the same window and the doctor-opened rule.
function CancelHandoff({
  entry,
  disabled,
  onCancel,
}: {
  entry: { handedOffAt?: string; doctorOpened?: boolean };
  disabled?: boolean;
  onCancel: () => void;
}) {
  const remaining = () =>
    entry.handedOffAt
      ? Math.ceil(
          (Date.parse(entry.handedOffAt) + handoffCancelMs - Date.now()) / 1000
        )
      : 0;
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(remaining()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.handedOffAt]);
  if (entry.doctorOpened || seconds <= 0) return null;
  return (
    <button
      type="button"
      className="secretary-outline"
      disabled={disabled}
      onClick={onCancel}
    >
      إلغاء الإدخال ({seconds} ث)
    </button>
  );
}
