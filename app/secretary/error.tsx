"use client";

export default function SecretaryError({ reset }: { error: Error; reset: () => void }) {
  return <main className="secretary-error-page" dir="rtl"><h1>تعذّر تحميل بيانات العيادة</h1><p>تحقق من الاتصال وإعداد قاعدة البيانات، ثم حاول مرة أخرى.</p><button className="secretary-primary" onClick={reset}>إعادة المحاولة</button></main>;
}
