import type { PrintPlan } from "@/shared/print-plan";

function dateLabel(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isNaN(date.getTime())
    ? "غير محدد"
    : new Intl.DateTimeFormat("ar-SY", {
        timeZone: "Asia/Damascus",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
}

export function PrintDocument({
  plan,
  demo = false,
}: {
  plan: PrintPlan;
  demo?: boolean;
}) {
  return (
    <article className="print-document" aria-label="البرنامج الغذائي للمريض">
      <header>
        <h1>البرنامج الغذائي</h1>
        <p className="print-clinic">{plan.clinicName}</p>
        {demo && <p>عرض تجريبي خيالي · ليس وصفة طبية ولا يُستخدم للعلاج.</p>}
        <dl className="print-details">
          <div>
            <dt>اسم المريض</dt>
            <dd>{plan.patientName}</dd>
          </div>
          <div>
            <dt>تاريخ الزيارة</dt>
            <dd>{dateLabel(plan.visitDate)}</dd>
          </div>
        </dl>
      </header>
      {plan.days.map((day, index) => (
        <section
          className="print-day"
          key={index}
          aria-label={`اليوم ${index + 1}`}
        >
          <h2>اليوم {index + 1}</h2>
          {day.meals.map((meal, mealIndex) => (
            <div className="print-meal" key={mealIndex}>
              <h3>{meal.type}</h3>
              <p>{meal.description}</p>
            </div>
          ))}
        </section>
      ))}
      <footer className="print-appointment">
        <h2>موعد المراجعة القادمة</h2>
        <p>
          {plan.appointment
            ? dateLabel(plan.appointment)
            : "لم يُحدّد موعد مراجعة."}
        </p>
      </footer>
    </article>
  );
}
