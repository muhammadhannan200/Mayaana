import { measurementFields, type QueueEntry } from "@/shared/clinical-model";
import { VisitAttachments } from "./visit-attachments";

export function VisitMeasurements({
  entryId,
  measurements,
  previous,
  towardsGoal,
  delta,
  completed,
  demo,
  pending,
  notes,
  onNotes,
}: {
  entryId: string;
  measurements: QueueEntry["measurements"];
  previous?: string;
  towardsGoal: boolean;
  delta: number | null;
  completed: boolean;
  demo: boolean;
  pending?: boolean;
  notes: string;
  onNotes: (notes: string) => void;
}) {
  return (
    <>
      <section className="visit-weight">
        <div>
          <strong>
            <bdi>{measurements.weight} كغ</bdi>
          </strong>
          <small>{previous ? `آخر زيارة ${previous} كغ` : "أول زيارة"}</small>
        </div>
        {delta !== null && (
          <span className={towardsGoal ? "visit-delta good" : "visit-delta"}>
            <bdi>{Math.abs(delta).toFixed(1)} كغ</bdi> ·{" "}
            {delta < 0 ? "نزول" : delta > 0 ? "زيادة" : "ثابت"}
          </span>
        )}
      </section>
      {completed && (
        <dl className="demo-measurements">
          {measurementFields
            .filter(
              (field) => field.key !== "weight" && measurements[field.key]
            )
            .map((field) => (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>
                  <bdi>
                    {measurements[field.key]} {field.unit}
                  </bdi>
                </dd>
              </div>
            ))}
        </dl>
      )}
      <section className="visit-notes">
        <label htmlFor="visit-notes">ملاحظاتي</label>
        <textarea
          id="visit-notes"
          rows={4}
          maxLength={4000}
          readOnly={completed}
          disabled={pending}
          placeholder="اكتب ملاحظات زيارة اليوم…"
          value={notes}
          onChange={(event) => onNotes(event.target.value)}
        />
      </section>
      <VisitAttachments entry={entryId} demo={demo} readOnly={completed} />
    </>
  );
}
