"use client";

import { useState } from "react";
import Link from "next/link";
import { changePassword } from "@/backend/actions/auth-actions";
import { SignOutForm } from "@/frontend/auth/sign-out-form";
import { PasswordInput } from "@/frontend/auth/password-input";
import { FieldError, useAuthForm } from "@/frontend/auth/use-auth-form";
import { validatePassword } from "@/shared/auth-validation";

export function PasswordForm({ firstUse }: { firstUse: boolean }) {
  const {
    formRef,
    action,
    pending,
    errors,
    onChange,
    onSubmit,
    message,
    attempt,
  } = useAuthForm(changePassword, (data) => validatePassword(data, !firstUse));
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="auth-content">
          <div className="page-header">
            <h1>{firstUse ? "إنشاء كلمة مرور جديدة" : "تغيير كلمة المرور"}</h1>
            {firstUse ? (
              <SignOutForm />
            ) : (
              <Link className="text-link" href="/doctor">
                رجوع
              </Link>
            )}
          </div>
          <p className="message message-info">
            {firstUse
              ? "استخدم كلمة مرور خاصة بك قبل متابعة العمل."
              : "أدخل كلمة المرور الحالية ثم اختر كلمة مرور جديدة."}
          </p>
          <form
            ref={formRef}
            className="auth-form"
            action={action}
            noValidate
            onChange={onChange}
            onSubmit={onSubmit}
          >
            <div className="fields">
              {!firstUse && (
                <div className="field">
                  <label htmlFor="currentPassword">كلمة المرور الحالية</label>
                  <PasswordInput
                    visibilityLabel="كلمة المرور الحالية"
                    id="currentPassword"
                    name="currentPassword"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    aria-invalid={Boolean(errors.currentPassword)}
                    aria-describedby={
                      errors.currentPassword
                        ? "currentPassword-error"
                        : undefined
                    }
                    required
                  />
                  <FieldError
                    id="currentPassword-error"
                    error={errors.currentPassword}
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
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password
                      ? "newPassword-hint newPassword-error"
                      : "newPassword-hint"
                  }
                  required
                />
                <p id="newPassword-hint" className="message message-info">
                  استخدم 8 أحرف على الأقل.
                </p>
                <FieldError id="newPassword-error" error={errors.password} />
              </div>
              <div className="field">
                <label htmlFor="confirmation">تأكيد كلمة المرور</label>
                <PasswordInput
                  visibilityLabel="تأكيد كلمة المرور"
                  id="confirmation"
                  name="confirmation"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  aria-invalid={Boolean(errors.confirmation)}
                  aria-describedby={
                    errors.confirmation
                      ? "confirmation-hint confirmation-error"
                      : "confirmation-hint"
                  }
                  required
                />
                <p id="confirmation-hint" className="message message-info">
                  أعد إدخال كلمة المرور الجديدة نفسها.
                </p>
                <FieldError
                  id="confirmation-error"
                  error={errors.confirmation}
                />
              </div>
            </div>
            <div className="form-actions">
              {message && (
                <p
                  key={attempt}
                  className="message message-error message-box"
                  role="alert"
                >
                  {message}
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
