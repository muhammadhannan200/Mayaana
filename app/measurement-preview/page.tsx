import Link from "next/link";

export default function MeasurementPreviews() {
  return (
    <main className="auth-shell" dir="rtl">
      <section className="auth-panel logged-in">
        <h1>معاينة شاشات القياس</h1>
        <p>بيانات خيالية فقط. لا تُحفظ القياسات ولا تُرسل للطبيب.</p>
        <nav className="account-links" aria-label="شاشات القياس">
          <Link className="text-link" href="/measurement-preview/follow-up">
            S5 · قياس الوزن
          </Link>
          <Link className="text-link" href="/measurement-preview/previous">
            S5b · قياسات الزيارات السابقة
          </Link>
          <Link className="text-link" href="/measurement-preview/full-exam">
            S6 · قياس كامل
          </Link>
          <Link className="text-link" href="/">
            العودة لتسجيل الدخول
          </Link>
        </nav>
      </section>
    </main>
  );
}
