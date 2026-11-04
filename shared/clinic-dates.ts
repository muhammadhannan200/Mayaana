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
