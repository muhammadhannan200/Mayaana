"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { FieldErrors, FormResult } from "@/lib/auth-validation";

export function useAuthForm(
  submit: (previous: FormResult, data: FormData) => Promise<FormResult>,
  validate: (data: FormData) => FieldErrors
) {
  const formRef = useRef<HTMLFormElement>(null);
  // Keep the Server Action itself attached to the form, including its native
  // progressive-enhancement behavior. Client correction never bypasses it.
  const [state, action, pending] = useActionState(submit, null);
  const [attempt, setAttempt] = useState(0);
  const [corrections, setCorrections] = useState<{
    response: FormResult;
    errors: FieldErrors;
  } | null>(null);
  const [dismissedResponse, setDismissedResponse] = useState<FormResult>(null);
  const errors =
    state?.kind === "validation"
      ? corrections?.response === state
        ? corrections.errors
        : state.fieldErrors
      : {};

  useEffect(() => {
    if (state?.kind === "validation") {
      // DOM order, not translated error text, determines the first invalid field.
      formRef.current
        ?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')
        ?.focus();
    }
  }, [state]);

  function onChange(event: FormEvent<HTMLFormElement>) {
    // Dismiss only the response being corrected, never a future response from
    // an in-flight submission (even if it carries the same error text).
    setDismissedResponse(state);
    if (state?.kind === "validation")
      setCorrections({
        response: state,
        errors: validate(new FormData(event.currentTarget)),
      });
  }

  function onSubmit() {
    setAttempt((previous) => previous + 1);
    setCorrections(null);
    setDismissedResponse(state);
  }

  return {
    formRef,
    action,
    pending,
    errors,
    onChange,
    onSubmit,
    attempt,
    message:
      state === dismissedResponse || pending
        ? null
        : state?.kind === "validation"
          ? "تعذّر الإرسال. راجع الحقول الموضحة."
          : state?.error,
  };
}

export function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="message message-error">
      {error}
    </p>
  ) : null;
}
