const timeZone = "Asia/Damascus";

export function longDate(now = new Date()) {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

export function greeting(name?: string, now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now)
  );
  const opening = hour < 12 ? "صباح الخير" : "مساء الخير";
  const title = name?.trim().replace(/^(د\.|دكتور)\s*/, "");
  return title ? `${opening} د. ${title}` : `${opening} دكتور`;
}

// Shows stored YYYY-MM-DD dates as D/M/YYYY, including inside longer labels.
export function displayDate(value: string) {
  return value.replace(
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    (_, year, month, day) => `${Number(day)}/${Number(month)}/${year}`
  );
}

// The date some days after a YYYY-MM-DD date, or after today without one.
export function dateAfter(days: number, base?: string) {
  const date = base ? new Date(`${base}T12:00:00`) : new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
