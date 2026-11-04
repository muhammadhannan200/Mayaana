import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { referrer: "no-referrer" };

// Fixed public guidance, not an email-token callback or password-update form.
// Intentionally ignore all URL parameters and preserve existing staff sessions.
export default function LegacyRecoveryPage() {
  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="auth-content">
          <div className="page-header">
            <h1>استعادة الوصول للحساب</h1>
          </div>
          <p className="message message-info">
            روابط البريد لا تغيّر كلمة المرور في هذا النظام.
          </p>
          <p className="message message-info">
            السكرتيرة: تواصلي مع الطبيب · الطبيب: تواصل مع مسؤول النظام
          </p>
          <p className="message message-info">
            بعد استلام كلمة مرور مؤقتة، سجّل الدخول بها ثم أنشئ كلمة مرور خاصة بك
            قبل متابعة العمل.
          </p>
          <Link className="text-link" href="/" referrerPolicy="no-referrer">
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    </main>
  );
}
