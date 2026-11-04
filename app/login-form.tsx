"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { signIn } from "./actions";
import { PasswordInput } from "./password-input";
import { FieldError, useAuthForm } from "./use-auth-form";
import { validateLogin } from "@/lib/auth-validation";

function EmailIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m4 7 8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LoginForm({ configured }: { configured: boolean }) {
  const {
    formRef,
    action,
    pending,
    errors,
    onChange,
    onSubmit,
    message,
    attempt,
  } = useAuthForm(signIn, validateLogin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    function checkLegacyFragment() {
      // Fragments never reach the server. Discard them without passing their
      // values to Auth, storage, rendered copy or a user-supplied destination.
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (
        [
          "code", "token_hash", "access_token", "refresh_token", "error", "error_code",
        ].some((key) => hash.has(key)) ||
        hash.getAll("type").includes("recovery")
      )
        window.location.replace("/auth/confirm");
    }
    checkLegacyFragment();
    window.addEventListener("hashchange", checkLegacyFragment);
    return () => window.removeEventListener("hashchange", checkLegacyFragment);
  }, []);

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="auth-content">
          <header className="brand-row">
            <Image
              className="brand-mark"
              src="/rashaqa/login-mark-layer-b-1e6366.png"
              width={63}
              height={54}
              alt=""
              priority
            />
            <div>
              <p className="brand-name">معاينة</p>
              <p className="brand-caption">متابعة الوزن والتغذية</p>
            </div>
          </header>

          <div className="intro">
            <h1>أهلاً بك</h1>
            <p>ادخل ببريدك الإلكتروني وكلمة المرور</p>
          </div>

          <form
            ref={formRef}
            className="auth-form"
            action={action}
            noValidate
            onChange={onChange}
            onSubmit={onSubmit}
          >
            <div className="fields">
              <div className="field">
                <label htmlFor="email">البريد الإلكتروني</label>
                <div className="input-wrap input-wrap-email">
                  <EmailIcon />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    dir="ltr"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                </div>
                <FieldError id="email-error" error={errors.email} />
              </div>

              <div className="field">
                <label htmlFor="password">كلمة المرور</label>
                <PasswordInput
                  visibilityLabel="كلمة المرور"
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                />
                <FieldError id="password-error" error={errors.password} />
              </div>
            </div>

            <div className="form-actions">
              {!configured && !message && !pending && (
                <p className="message message-error message-box" role="alert">
                  إعداد خدمة الدخول غير مكتمل.
                </p>
              )}
              {message && (
                <p
                  key={attempt}
                  className="message message-error message-box"
                  role="alert"
                >
                  {message}
                </p>
              )}
              <button
                className="submit"
                type="submit"
                disabled={pending || !configured}
              >
                {pending ? "جارٍ الدخول…" : "دخول"}
              </button>
              <div className="help">
                <p>نسيت كلمة المرور؟</p>
                <p>
                  السكرتيرة: تواصلي مع الطبيب · الطبيب: تواصل مع مسؤول النظام
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
