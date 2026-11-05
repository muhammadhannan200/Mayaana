"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/frontend/components/icon";
import { dayCountLabel, mealCountLabel } from "@/shared/arabic-count";
import type { VisitDraft } from "@/shared/clinical-model";

type SaveDraft = (change: (current: VisitDraft) => VisitDraft) => void;

// Lives in the visit, not the diet tab: leaving the tab must keep an unsaved meal.
export function useMealEditor(save: SaveDraft) {
  const [editing, setEditing] = useState<{ day: string; meal?: string } | null>(
    null
  );
  const [mealType, setMealType] = useState("فطور");
  const [description, setDescription] = useState("");

  function saveMeal(event: FormEvent) {
    event.preventDefault();
    if (!editing || !description.trim()) return;
    const meal = {
      id: editing.meal ?? crypto.randomUUID(),
      type: mealType,
      description: description.trim(),
    };
    save((current) => ({
      ...current,
      days: current.days.map((day) =>
        day.id === editing.day
          ? {
              ...day,
              meals: editing.meal
                ? day.meals.map((item) =>
                    item.id === editing.meal ? meal : item
                  )
                : [...day.meals, meal],
            }
          : day
      ),
    }));
    setEditing(null);
    setDescription("");
  }
  return {
    editing,
    setEditing,
    mealType,
    setMealType,
    description,
    setDescription,
    saveMeal,
  };
}

export function VisitDiet({
  visit,
  meals,
  completed,
  demo,
  pending,
  appointment,
  minAppointment,
  save,
  editor,
}: {
  visit: VisitDraft;
  meals: number;
  completed: boolean;
  demo: boolean;
  pending?: boolean;
  appointment: string;
  minAppointment: string;
  save: SaveDraft;
  editor: ReturnType<typeof useMealEditor>;
}) {
  const {
    editing,
    setEditing,
    mealType,
    setMealType,
    description,
    setDescription,
    saveMeal,
  } = editor;
  return (
    <section className="visit-diet">
      <div className="visit-section-heading">
        <div>
          <h2>البرنامج الغذائي</h2>
          <small>
            {dayCountLabel(visit.days.length)} · {mealCountLabel(meals)}
          </small>
        </div>
      </div>
      {visit.days.map((day, index) => (
        <section
          key={day.id}
          className="visit-day"
          aria-label={`اليوم ${index + 1}`}
        >
          <div className="visit-section-heading">
            <h3>اليوم {index + 1}</h3>
            {!completed && (
              <button
                type="button"
                className="visit-icon"
                aria-label={`حذف اليوم ${index + 1}`}
                onClick={() => {
                  if (
                    !window.confirm("حذف هذا اليوم وجميع وجباته من البرنامج؟")
                  )
                    return;
                  save((current) => ({
                    ...current,
                    days: current.days.filter((item) => item.id !== day.id),
                  }));
                  if (editing?.day === day.id) setEditing(null);
                }}
              >
                <Icon name="trash" size={18} />
              </button>
            )}
          </div>
          {day.meals.map((meal) => (
            <div key={meal.id} className="visit-meal">
              <div>
                <strong>{meal.type}</strong>
                <p>{meal.description}</p>
              </div>
              {!completed && (
                <div className="visit-meal-actions">
                  <button
                    type="button"
                    className="visit-icon"
                    aria-label={`تعديل ${meal.type}`}
                    onClick={() => {
                      setEditing({ day: day.id, meal: meal.id });
                      setMealType(meal.type);
                      setDescription(meal.description);
                    }}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    type="button"
                    className="visit-icon"
                    aria-label={`حذف ${meal.type}`}
                    onClick={() => {
                      if (
                        !demo &&
                        !window.confirm("حذف هذه الوجبة من المسودة؟")
                      )
                        return;
                      save((current) => ({
                        ...current,
                        days: current.days.map((item) =>
                          item.id === day.id
                            ? {
                                ...item,
                                meals: item.meals.filter(
                                  (m) => m.id !== meal.id
                                ),
                              }
                            : item
                        ),
                      }));
                      if (editing?.meal === meal.id) setEditing(null);
                    }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {!completed &&
            (editing?.day === day.id ? (
              <form className="visit-new-meal" onSubmit={saveMeal}>
                <h3>{editing.meal ? "تعديل الوجبة" : "وجبة جديدة"}</h3>
                <fieldset className="visit-meal-types">
                  <legend className="sr-only">نوع الوجبة</legend>
                  {["فطور", "غداء", "سناك", "عشاء", "أخرى"].map((type) => (
                    <label
                      key={type}
                      className={mealType === type ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name="mealType"
                        checked={mealType === type}
                        onChange={() => setMealType(type)}
                      />
                      {type}
                    </label>
                  ))}
                </fieldset>
                <label className="secretary-field">
                  تفاصيل الوجبة
                  <textarea
                    autoFocus
                    required
                    maxLength={1000}
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                <small>اكتب الوجبة كما تريد أن يقرأها المريض</small>
                <div className="visit-buttons">
                  <button
                    className="secretary-primary"
                    type="submit"
                    disabled={!description.trim()}
                  >
                    {editing.meal ? "حفظ الوجبة" : "إضافة الوجبة"}
                  </button>
                  <button
                    className="secretary-outline"
                    type="button"
                    onClick={() => setEditing(null)}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="visit-dashed"
                type="button"
                onClick={() => {
                  setEditing({ day: day.id });
                  setMealType("فطور");
                  setDescription("");
                }}
              >
                <Icon name="plus" size={18} />
                إضافة وجبة
              </button>
            ))}
        </section>
      ))}
      {!completed && (
        <button
          type="button"
          className="visit-dashed"
          onClick={() =>
            save((current) => ({
              ...current,
              days: [...current.days, { id: crypto.randomUUID(), meals: [] }],
            }))
          }
        >
          <Icon name="plus" size={20} />
          إضافة يوم
        </button>
      )}
      <section className="visit-appointment">
        <h2>موعد المراجعة القادمة</h2>
        {completed ? (
          <p>{appointment || "لم يُحدّد موعد متابعة"}</p>
        ) : (
          <label className="secretary-field">
            تاريخ الموعد
            <input
              type="date"
              disabled={pending}
              min={minAppointment}
              value={appointment}
              onChange={(event) =>
                save((current) => ({
                  ...current,
                  appointment: event.target.value,
                }))
              }
            />
          </label>
        )}
        {(!completed || visit.appointment) && (
          <small>
            {visit.appointment
              ? "موعد مخصص لهذه الزيارة"
              : "يُحسب تلقائياً: اليوم التالي لنهاية البرنامج"}
          </small>
        )}
      </section>
    </section>
  );
}
