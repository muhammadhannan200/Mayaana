"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDemoClinic } from "@/frontend/demo/demo-clinic";
import { dietPlanMessage, whatsappUrl } from "@/shared/whatsapp";
import type { VisitDraft } from "@/shared/clinical-model";
import { useMealEditor, VisitDiet } from "./visit-diet";
import { VisitDraftStatus, type DoctorDraft } from "./visit-draft-status";
import { FinishReview } from "./visit-finish-review";
import { VisitActionBar, VisitUnavailable } from "./visit-action-bar";
import { VisitHeader } from "./visit-header";
import { completeDemoVisit } from "./demo-visit";
import { useUnsavedGuard } from "./use-unsaved-guard";
import { VisitMeasurements } from "./visit-measurements";
import "./visit.css";
import type {
  ClinicalOperations,
  ClinicalSnapshot,
  ClinicEntry,
} from "@/shared/clinical-types";

function dateAfter(days: number, base?: string) {
  const date = base ? new Date(`${base}T12:00:00`) : new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DoctorVisit({
  entryId,
  demo,
  clinical,
  operations,
}: {
  entryId: string;
  demo: boolean;
  clinical?: ClinicalSnapshot;
  operations?: ClinicalOperations;
}) {
  return demo ? (
    <DemoDoctorVisit entryId={entryId} />
  ) : (
    <VisitEditor
      entryId={entryId}
      demo={false}
      clinical={clinical}
      operations={operations}
    />
  );
}

function DemoDoctorVisit({ entryId }: { entryId: string }) {
  const local = useDemoClinic();
  return <VisitEditor entryId={entryId} demo local={local} />;
}

function VisitEditor({
  entryId,
  demo,
  clinical,
  operations,
  local,
}: {
  entryId: string;
  demo: boolean;
  clinical?: ClinicalSnapshot;
  operations?: ClinicalOperations;
  local?: ReturnType<typeof useDemoClinic>;
}) {
  const { patients, queue } = clinical ?? local!;
  const update: ReturnType<typeof useDemoClinic>["update"] =
    local?.update ??
    (() => {
      throw new Error("Authenticated visits require clinical operations");
    });
  const params = useSearchParams();
  const router = useRouter();
  const prefix = demo ? "/demo" : "";
  const href = (path: string) => `${prefix}/doctor${path}`;
  const entry = queue.find((item) => item.id === entryId);
  const patient = patients.find((item) => item.id === entry?.patientId);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const plan = params.get("step") === "plan";
  const completed = entry?.status === "completed";
  const needsOpen = entry?.status === "with_doctor" && !entry.doctorOpened;
  useEffect(() => {
    if (!needsOpen) return;
    if (operations) void operations.openVisit(entryId);
    else local?.openVisit(entryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOpen, entryId]);
  const [draft, setDraft] = useState<DoctorDraft | null>(null);
  const visit: VisitDraft = (!demo && !completed && draft?.visit) ||
    entry?.visit || {
      notes: "",
      days: [],
      appointment: "",
    };
  function appointmentOn(date?: string) {
    return (
      visit.appointment ||
      (completed ? "" : dateAfter(Math.max(1, visit.days.length), date))
    );
  }
  const appointment = appointmentOn(
    demo ? local!.today : clinical?.serviceDate
  );
  const meals = visit.days.reduce((sum, day) => sum + day.meals.length, 0);
  const visitHref = href(`/visits/${entryId}`);
  const revision = (entry as ClinicEntry | undefined)?.revision ?? 0;
  const stale = !!draft && draft.revision !== revision;
  function save(change: (current: VisitDraft) => VisitDraft) {
    if (operations) {
      if (completed || operations.pending) return;
      setDraft((current) => ({
        visit: change(current?.visit ?? visit),
        revision: current?.revision ?? revision,
      }));
      setError("");
      return;
    }
    update((state) => ({
      ...state,
      queue: state.queue.map((item) =>
        item.id === entryId && item.status === "with_doctor"
          ? {
              ...item,
              visit: change(
                item.visit ?? { notes: "", days: [], appointment: "" }
              ),
            }
          : item
      ),
    }));
    setError("");
  }
  const editor = useMealEditor(save);
  const { editing, description } = editor;
  useUnsavedGuard(!demo && (!!draft || !!(editing && description.trim())));

  async function finish() {
    if (operations) {
      if (
        await operations.finishVisit(entryId, draft?.revision ?? revision, {
          ...visit,
          appointment,
        })
      ) {
        setDraft(null);
        setReview(false);
        router.replace(visitHref);
      }
      return;
    }
    // A suspended tab or open confirmation can cross midnight before timers or
    // resume events run. Recheck demo dates at the final local write boundary.
    const today = local!.currentDate();
    const completedAppointment = appointmentOn(today);
    if (completedAppointment <= dateAfter(0, today)) {
      setReview(false);
      setError("اختر موعد مراجعة بعد اليوم.");
      return;
    }
    const completedAt = new Date().toISOString();
    update((state) =>
      completeDemoVisit(state, entryId, {
        ...visit,
        appointment: completedAppointment,
        completedAt,
      })
    );
    setReview(false);
    router.replace(visitHref);
  }

  if (
    !entry ||
    !patient ||
    !["with_doctor", "completed"].includes(entry.status)
  )
    return <VisitUnavailable homeHref={href("")} />;

  const weight = Number(entry.measurements.weight);
  const previous = patient.visits.find((item) => item.id !== entry.id)
    ?.measurements.weight;
  const delta = previous ? weight - Number(previous) : null;
  const towardsGoal =
    delta !== null && (patient.goal === "زيادة وزن" ? delta > 0 : delta < 0);

  const whatsappLink = whatsappUrl(
    patient.phone,
    dietPlanMessage({
      patientName: patient.name,
      days: visit.days,
      appointment: visit.appointment,
    })
  );

  function requestFinish() {
    if (editing) {
      setError("احفظ الوجبة أو ألغِ تعديلها أولاً.");
      return;
    }
    if (!visit.days.length || visit.days.some((day) => !day.meals.length)) {
      setError("أضف يوماً ووجبة واحدة على الأقل لكل يوم قبل الإنهاء.");
      return;
    }
    const date = demo ? local!.currentDate() : clinical?.serviceDate;
    const currentAppointment = demo ? appointmentOn(date) : appointment;
    if (currentAppointment <= dateAfter(0, date)) {
      setError("اختر موعد مراجعة بعد اليوم.");
      return;
    }
    setError("");
    setReview(true);
  }

  return (
    <main className="doctor-shell visit-shell" dir="rtl">
      <VisitHeader
        completed={completed}
        plan={plan}
        visitHref={visitHref}
        patientName={patient.name}
        kind={entry.kind}
        patientHref={href(`/patients/${patient.id}`)}
      />
      <fieldset
        className="visit-content clinical-fieldset"
        disabled={operations?.pending}
      >
        <VisitDraftStatus
          demo={demo}
          completed={completed}
          draft={draft}
          stale={stale}
          pending={operations?.pending}
          editing={!!editing}
          onSave={async () => {
            if (
              operations &&
              (await operations.saveDoctorDraft(
                entryId,
                draft?.revision ?? revision,
                { ...visit, appointment }
              ))
            )
              setDraft(null);
          }}
          onDiscard={() => setDraft(null)}
        />
        {(!plan || completed) && (
          <>
            <VisitMeasurements
              entryId={entryId}
              measurements={entry.measurements}
              previous={previous}
              towardsGoal={towardsGoal}
              delta={delta}
              completed={completed}
              demo={demo}
              pending={operations?.pending}
              notes={visit.notes}
              onNotes={(notes) => save((current) => ({ ...current, notes }))}
            />
          </>
        )}
        {(plan || completed) && (
          <VisitDiet
            visit={visit}
            meals={meals}
            completed={completed}
            demo={demo}
            pending={operations?.pending}
            appointment={appointment}
            minAppointment={dateAfter(
              1,
              demo ? local!.today : clinical?.serviceDate
            )}
            save={save}
            editor={editor}
          />
        )}
        {error && (
          <p className="secretary-error" role="alert">
            {error}
          </p>
        )}
        {demo && (
          <p className="demo-flow-note">
            عرض تجريبي · حفظ تلقائي في هذا المتصفح فقط. لا تدخل بيانات حقيقية.
          </p>
        )}
      </fieldset>
      <VisitActionBar
        completed={completed}
        plan={plan}
        homeHref={href("")}
        visitHref={visitHref}
        whatsappLink={whatsappLink}
        disabled={operations?.pending || stale}
        onFinish={requestFinish}
      />
      {review && !completed && (
        <FinishReview
          patientName={patient.name}
          weight={entry.measurements.weight}
          hasNotes={!!visit.notes.trim()}
          days={visit.days.length}
          meals={meals}
          appointment={appointment}
          disabled={operations?.pending}
          stale={stale}
          onFinish={finish}
          onClose={() => setReview(false)}
        />
      )}
    </main>
  );
}
