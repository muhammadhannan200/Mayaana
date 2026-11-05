"use client";

import Link from "next/link";
import { Icon } from "@/frontend/components/icon";
import { measurementFields } from "@/shared/clinical-model";
import type { MockVisit } from "./mock-visits";

export function TopBar({
  title,
  subtitle,
  closeHref,
}: {
  title: string;
  subtitle?: string;
  closeHref: string;
}) {
  return (
    <header className="measure-topbar">
      <Link
        className="measure-icon-button"
        href={closeHref}
        aria-label="إغلاق شاشة القياس"
      >
        <Icon name="close" size={20} />
      </Link>
      <div className="measure-topbar-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <span className="measure-topbar-spacer" aria-hidden="true" />
    </header>
  );
}

export function VisitBadge({ kind }: { kind: MockVisit["kind"] }) {
  return (
    <span
      className={kind === "full_exam" ? "measure-badge exam" : "measure-badge"}
    >
      <Icon name={kind === "full_exam" ? "ruler" : "scale"} size={14} />
      {kind === "full_exam" ? "كشفية" : "مراجعة"}
    </span>
  );
}

export function WeightDelta({
  children,
  increase = false,
}: {
  children: React.ReactNode;
  increase?: boolean;
}) {
  return (
    <span className={`measure-delta${increase ? " away" : ""}`}>
      <span className={increase ? "measure-up" : undefined}>
        <Icon name="down" size={14} />
      </span>
      {children}
    </span>
  );
}

export function NumericField({
  field,
  value,
  previous,
  onChange,
  error,
}: {
  field: (typeof measurementFields)[number];
  value: string;
  previous?: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <label className="measure-field">
      <span>{field.label}</span>
      <span className="measure-input-wrap">
        <input
          type="text"
          inputMode="decimal"
          dir="ltr"
          aria-label={field.label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${field.key}-error` : undefined}
        />
        <span>{field.unit}</span>
      </span>
      {error ? (
        <small id={`${field.key}-error`} className="measure-field-error">
          {error}
        </small>
      ) : (
        previous && (
          <small>
            السابق: <bdi>{previous}</bdi>
          </small>
        )
      )}
    </label>
  );
}
