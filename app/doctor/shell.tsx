import Link from "next/link";
import { Icon } from "@/app/secretary/components";

export function DoctorShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: "home" | "patients";
}) {
  return (
    <main className="doctor-shell">
      <div className="doctor-scroll">{children}</div>
      <nav className="doctor-nav" aria-label="التنقل الرئيسي">
        <Link
          href="/doctor"
          className={active === "home" ? "active" : ""}
          aria-current={active === "home" ? "page" : undefined}
        >
          <Icon name="queue" />
          الرئيسية
        </Link>
        <Link
          href="/doctor/patients"
          className={active === "patients" ? "active" : ""}
          aria-current={active === "patients" ? "page" : undefined}
        >
          <Icon name="patients" />
          المرضى
        </Link>
        <Link href="/doctor/staff">
          <Icon name="account" />
          الحساب
        </Link>
      </nav>
    </main>
  );
}
