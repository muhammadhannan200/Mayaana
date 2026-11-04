type CountForms = {
  one: string;
  two: string;
  few: (count: number) => string;
  many: (count: number) => string;
};

function arabicCount(count: number, forms: CountForms) {
  if (count === 1) return forms.one;
  if (count === 2) return forms.two;
  const lastTwo = count % 100;
  return lastTwo >= 3 && lastTwo <= 10 ? forms.few(count) : forms.many(count);
}

export const dayCountLabel = (count: number) =>
  count === 0
    ? "0 أيام"
    : arabicCount(count, {
        one: "يوم واحد",
        two: "يومان",
        few: (n) => `${n} أيام`,
        many: (n) => `${n} يوماً`,
      });

export const mealCountLabel = (count: number) =>
  count === 0
    ? "0 وجبات"
    : arabicCount(count, {
        one: "وجبة واحدة",
        two: "وجبتان",
        few: (n) => `${n} وجبات`,
        many: (n) => `${n} وجبة`,
      });

export const visitCountLabel = (count: number) =>
  count === 0
    ? "لا توجد زيارات سابقة"
    : arabicCount(count, {
        one: "زيارة سابقة واحدة",
        two: "زيارتان سابقتان",
        few: (n) => `${n} زيارات سابقة`,
        many: (n) => `${n} زيارة سابقة`,
      });

export function arabicVisitSummary(change: number, visits: number) {
  const direction = change < 0 ? "نزول" : change > 0 ? "زيادة" : "ثبات";
  return `${direction} ${Math.abs(change).toFixed(1)} كغ · ${visitCountLabel(visits)}`;
}
