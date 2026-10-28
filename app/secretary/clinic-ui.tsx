import Image from "next/image";
import Link from "next/link";
import type { ClinicEntry } from "@/lib/clinical-types";

const secretaryTabs = [
  { key: "queue", title: "الدور", href: "/secretary" },
  { key: "patients", title: "المرضى", href: "/secretary/patients" },
  { key: "search", title: "البحث", href: "/secretary/search" },
  { key: "account", title: "الحساب", href: "/secretary/account" },
] as const;

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
  return (
    <nav className="secretary-nav" aria-label="التنقل الرئيسي">
      {secretaryTabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`secretary-nav-item${active === tab.key ? " active" : ""}`}
          aria-current={active === tab.key ? "page" : undefined}
        >
          <Image
            src={`/rashaqa/nav-${tab.key}${active === tab.key ? "-active" : ""}.svg`}
            width={54}
            height={30}
            alt=""
            unoptimized
          />
          <span>{tab.title}</span>
        </Link>
      ))}
    </nav>
  );
}

export function DoctorNav({ route }: { route: string }) {
  const tabs = [
    { key: "home", title: "الرئيسية", href: "/doctor" },
    { key: "patients", title: "المرضى", href: "/doctor/patients" },
    { key: "search", title: "البحث", href: "/doctor/search" },
    // Keep master's existing destination until Account/Profile is implemented.
    { key: "account", title: "الحساب", href: "/doctor/staff" },
  ];
  const active = route.startsWith("doctor/patients")
    ? "patients"
    : route === "doctor/search"
      ? "search"
      : route === "doctor/staff"
        ? "account"
        : "home";
  return (
    <nav className="secretary-nav" aria-label="التنقل الرئيسي">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`secretary-nav-item${active === tab.key ? " active" : ""}`}
          aria-current={active === tab.key ? "page" : undefined}
        >
          <Image
            src={`/rashaqa/nav-${tab.key}${active === tab.key ? "-active" : ""}.svg`}
            width={54}
            height={30}
            alt=""
            unoptimized
          />
          <span>{tab.title}</span>
        </Link>
      ))}
    </nav>
  );
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
