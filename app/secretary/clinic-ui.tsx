import Image from "next/image";
import { AppNav, type AppNavTab } from "@/components/app-nav";
import type { ClinicEntry } from "@/lib/clinical-types";

const secretaryTabs: AppNavTab[] = [
  { key: "queue", title: "الدور", href: "/secretary" },
  { key: "patients", title: "المرضى", href: "/secretary/patients" },
  { key: "search", title: "البحث", href: "/secretary/search" },
  { key: "account", title: "الحساب", href: "/secretary/account" },
];

export function SecretaryNav({ route }: { route: string }) {
  const active =
    route === "secretary/patients/new" || route === "secretary/confirm"
      ? "search"
      : route.startsWith("secretary/patients")
        ? "patients"
        : route === "secretary/account"
          ? "account"
          : route === "secretary/search"
            ? "search"
            : "queue";
  return <AppNav tabs={secretaryTabs} active={active} />;
}

export function VisitType({ kind }: { kind: ClinicEntry["kind"] }) {
  return (
    <span className={`visit-badge${kind === "full_exam" ? " full" : ""}`}>
      <Image
        src={`/rashaqa/visit-${kind === "full_exam" ? "full-exam" : "follow-up"}.svg`}
        width={14}
        height={14}
        alt=""
        unoptimized
      />
      {kind === "full_exam" ? "كشفية" : "مراجعة"}
    </span>
  );
}

export function VisitOptions({
  kind,
  onChange,
  firstVisit = false,
}: {
  kind: ClinicEntry["kind"];
  onChange: (kind: ClinicEntry["kind"]) => void;
  firstVisit?: boolean;
}) {
  return (
    <fieldset className="visit-options">
      <legend>نوع الزيارة</legend>
      {(["full_exam", "follow_up"] as const).map((value) => (
        <label key={value} className={kind === value ? "selected" : undefined}>
          <input
            type="radio"
            name="visitType"
            checked={kind === value}
            disabled={firstVisit && value === "follow_up"}
            onChange={() => onChange(value)}
          />
          <span>
            <strong>{value === "full_exam" ? "كشفية" : "مراجعة"}</strong>
            <small>
              {value === "full_exam"
                ? "وزن + قياس كامل للجسم (دهون، عضل، محيطات)"
                : "وزن فقط"}
            </small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
