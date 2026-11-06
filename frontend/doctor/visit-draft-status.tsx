import type { VisitDraft } from "@/shared/clinical-model";

export type DoctorDraft = { visit: VisitDraft; revision: number };

export function VisitDraftStatus({
  demo,
  completed,
  draft,
  stale,
  pending,
  editing,
  onSave,
  onDiscard,
}: {
  demo: boolean;
  completed: boolean;
  draft: DoctorDraft | null;
  stale: boolean;
  pending?: boolean;
  editing: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <>
      {!demo && !completed && (
        <section className="clinical-draft">
          <p role="status">
            {pending
              ? "جارٍ الحفظ…"
              : draft
                ? "تعديلات غير محفوظة · احفظ المسودة قبل مغادرة الزيارة."
                : "النسخة المحفوظة في العيادة."}
          </p>
          {stale && (
            <p className="secretary-error" role="alert">
              تغيّرت الزيارة في جلسة أخرى. لم تُستبدل تعديلاتك. راجع النسخة
              المحفوظة قبل المتابعة.
            </p>
          )}
          <button
            type="button"
            className="secretary-outline"
            disabled={!draft || pending || stale || editing}
            onClick={onSave}
          >
            حفظ المسودة
          </button>
          {stale && (
            <button
              type="button"
              className="secretary-outline"
              onClick={() => {
                if (window.confirm("إلغاء تعديلاتك وتحميل النسخة المحفوظة؟"))
                  onDiscard();
              }}
            >
              تحميل النسخة المحفوظة وإلغاء تعديلاتي
            </button>
          )}
        </section>
      )}
      {completed && (
        <p className="secretary-success" role="status">
          اكتملت الزيارة · خرج المريض من الدور.
        </p>
      )}
      {!demo && completed && draft && (
        <section className="secretary-error" role="alert">
          <p>
            أُغلقت الزيارة في جلسة أخرى. المعروض أدناه هو السجل المحفوظ؛ لم
            تُحفظ تعديلات مسودتك.
          </p>
          <details>
            <summary>ملاحظات مسودتي غير المحفوظة</summary>
            <textarea
              aria-label="ملاحظات المسودة غير المحفوظة"
              readOnly
              value={draft.visit.notes}
            />
          </details>
        </section>
      )}
    </>
  );
}
