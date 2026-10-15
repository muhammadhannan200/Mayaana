"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { signIn } from "./actions";

function EmailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="10" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(signIn, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="auth-shell">
      <div className="auth-panel">
        <div className="auth-content">
          <header className="brand-row">
            <Image className="brand-mark" src="/rashaqa/login-mark-layer-b-1e6366b.png" width={63} height={54} alt="" priority />
            <div>
              <p className="brand-name">معاينة</p>
              <p className="brand-caption">متابعة الوزن والتغذية</p>
            </div>
          </header>

          <div className="intro">
            <h1>أهلاً بك</h1>
            <p>ادخل ببريدك الإلكتروني وكلمة المرور</p>
          </div>

          <form className="auth-form" action={action} noValidate>
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
                    aria-invalid={state?.kind === "validation" && state.error.includes("البريد")}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="password">كلمة المرور</label>
                <div className="input-wrap">
                  <LockIcon />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    aria-invalid={state?.kind === "validation" && state.error.includes("المرور")}
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              {!configured && <p className="message message-error message-box" role="alert">إعداد خدمة الدخول غير مكتمل.</p>}
              {state?.error && <p className="message message-error message-box" role="alert">{state.error}</p>}
              <button className="submit" type="submit" disabled={pending || !configured}>
                {pending ? "جارٍ الدخول…" : "دخول"}
              </button>
              <div className="help">
                <p>نسيت كلمة المرور؟</p>
                <p>السكرتيرة: تواصلي مع الطبيب · الطبيب: تواصل مع مسؤول النظام</p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
