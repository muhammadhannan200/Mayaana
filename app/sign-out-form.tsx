"use client";

import { useActionState, type ReactNode } from "react";
import { signOut } from "./actions";

export function SignOutForm({
  buttonClassName = "text-link",
  children = "تسجيل الخروج",
}: {
  buttonClassName?: string;
  children?: ReactNode;
}) {
  const [state, action, pending] = useActionState(signOut, null);
  return (
    <form action={action}>
      <button
        type="submit"
        className={buttonClassName}
        aria-label="تسجيل الخروج"
        aria-busy={pending}
        disabled={pending}
      >
        {children}
      </button>
      {pending && (
        <span className="sr-only" role="status">
          جارٍ تسجيل الخروج…
        </span>
      )}
      {state?.error && (
        <p className="message message-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
