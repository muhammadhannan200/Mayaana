import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/frontend/components/icon";

export function FlowSubheader({
  doctor,
  title,
  backHref,
  subtitle,
  menu,
  backIcon = doctor ? "arrow" : "close",
}: {
  doctor: boolean;
  title: string;
  backHref: string;
  subtitle?: string;
  menu?: ReactNode;
  backIcon?: "arrow" | "close";
}) {
  return (
    <header
      className={`secretary-subheader${doctor ? " doctor-record-header" : ""}`}
    >
      {menu}
      {doctor ? (
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      ) : (
        <h1>{title}</h1>
      )}
      <Link href={backHref} aria-label="العودة">
        <Icon name={backIcon} />
      </Link>
    </header>
  );
}

// The demo's bottom navigation. Signed-in staff get SecretaryNav or DoctorNav.
export function DemoNav({
  route,
  href,
}: {
  route: string;
  href: (path: string) => string;
}) {
  const doctor = route.startsWith("doctor");
  const active = doctor
    ? route.includes("patients")
      ? "patients"
      : "queue"
    : route.includes("search") || route.includes("confirm")
      ? "search"
      : route.includes("patients")
        ? "patients"
        : route.endsWith("account")
          ? "account"
          : "queue";
  const nav = doctor
    ? [
        { id: "queue", label: "الرئيسية", path: "doctor" },
        { id: "patients", label: "المرضى", path: "doctor/patients" },
        {
          id: "account",
          label: "الحساب",
          path: "secretary/account",
        },
      ]
    : [
        { id: "queue", label: "الدور", path: "secretary" },
        { id: "patients", label: "المرضى", path: "secretary/patients" },
        { id: "search", label: "البحث", path: "secretary/search" },
        { id: "account", label: "الحساب", path: "secretary/account" },
      ];
  return (
    <nav className="secretary-nav" aria-label="التنقل الرئيسي">
      {nav.map((item) => (
        <Link
          key={item.id}
          className={`secretary-nav-item${active === item.id ? " active" : ""}`}
          aria-current={active === item.id ? "page" : undefined}
          href={href(item.path)}
        >
          <span className="secretary-nav-icon">
            <Icon
              name={item.id as "queue" | "patients" | "search" | "account"}
            />
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
