"use client";

import Link from "next/link";

export default function DoctorError({ reset }: { reset: () => void }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel logged-in" role="alert">
        <h1>تعذّر تحميل بيانات العيادة</h1>
        <p>
          حاول مرة أخرى. إذا استمرت المشكلة، تواصل مع مسؤول العيادة للتحقق من
          جاهزية بيانات المرضى والدور.
        </p>
        <button type="button" className="primary-button" onClick={reset}>
          إعادة المحاولة
        </button>
        <Link className="text-link" href="/doctor/staff">
          حسابات العيادة
        </Link>
      </section>
    </main>
  );
}
