"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions";
import { SignOutForm } from "@/app/sign-out-form";
import { PasswordInput } from "@/app/password-input";

export function PasswordForm({ firstUse }: { firstUse: boolean }) {
  const [state, action, pending] = useActionState(changePassword, null);

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="auth-content">
          <div className="page-header">
            <h1>{firstUse ? "إنشاء كلمة مرور جديدة" : "تغيير كلمة المرور"}</h1>
            <SignOutForm />
          </div>
          <p className="message message-info">
            {firstUse
              ? "استخدم كلمة مرور خاصة بك قبل متابعة العمل."
              : "أدخل كلمة المرور الحالية ثم اختر كلمة مرور جديدة."}
          </p>
          <form className="auth-form" action={action}>
            <div className="fields">
              {!firstUse && (
                <div className="field">
                  <label htmlFor="currentPassword">كلمة المرور الحالية</label>
                  <PasswordInput
                    visibilityLabel="كلمة المرور الحالية"
                    id="currentPassword"
                    name="currentPassword"
                    autoComplete="current-password"
                    required
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="newPassword">كلمة المرور الجديدة</label>
                <PasswordInput
                  visibilityLabel="كلمة المرور الجديدة"
                  id="newPassword"
                  name="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="confirmation">تأكيد كلمة المرور</label>
                <PasswordInput
                  visibilityLabel="تأكيد كلمة المرور"
                  id="confirmation"
                  name="confirmation"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              {state?.error && (
                <p className="message message-error message-box" role="alert">
                  {state.error}
                </p>
              )}
              <button className="submit" type="submit" disabled={pending}>
                {pending ? "جارٍ الحفظ…" : "حفظ كلمة المرور"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
