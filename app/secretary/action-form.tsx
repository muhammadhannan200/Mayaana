"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { QueueActionResult } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="secretary-primary" type="submit" disabled={pending}>{pending ? "جارٍ الحفظ…" : label}</button>;
}

export function ActionForm({ action, label, children, className }: {
  action: (previous: QueueActionResult, form: FormData) => Promise<QueueActionResult>;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, submit] = useActionState(action, null);
  return <form action={submit} className={className}>
    {children}
    {state?.error && <p role="alert" className="secretary-error">{state.error}</p>}
    <Submit label={label} />
  </form>;
}
