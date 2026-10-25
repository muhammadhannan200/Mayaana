import Link from "next/link";
import { SignOutForm } from "@/app/sign-out-form";
import type { ClinicRole } from "@/lib/auth";

export function RoleHome({ role }: { role: ClinicRole }) {
  const doctor = role === "doctor";

  return (
    <main className="auth-shell">
      <div className="auth-panel logged-in">
        <div className="page-header">
          <h1>{doctor ? "الرئيسية" : "الدور"}</h1>
          <SignOutForm />
        </div>
        <div className="welcome-card">
          <h2>{doctor ? "أهلاً بك، دكتور" : "أهلاً بك"}</h2>
          <p>
            تم تسجيل الدخول إلى حساب {doctor ? "الطبيب" : "السكرتيرة"} بنجاح.
          </p>
        </div>
        {doctor && (
          <div className="account-links">
            <Link className="text-link" href="/doctor/staff">
              حسابات العيادة
            </Link>
            <Link className="text-link" href="/change-password">
              تغيير كلمة المرور
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
