import Link from "next/link";
import { Icon } from "@/frontend/components/icon";

export function VisitHeader({
  completed,
  plan,
  visitHref,
  patientName,
  kind,
  patientHref,
}: {
  completed: boolean;
  plan: boolean;
  visitHref: string;
  patientName: string;
  kind: string;
  patientHref: string;
}) {
  return (
    <>
      <header className="doctor-topbar">
        {completed && (
          // Start a fresh document: client navigation retains hidden visit
          // markup (including notes) in Next's mounted route cache.
          <a
            className="doctor-back visit-header-action"
            href={`${visitHref}/print`}
            aria-label="طباعة البرنامج"
          >
            <Icon name="print" size={20} />
          </a>
        )}
        <div>
          <h1>{completed ? "الزيارة المكتملة" : "زيارة اليوم"}</h1>
          <p>
            {patientName} · {kind === "full_exam" ? "كشفية" : "مراجعة"}
          </p>
        </div>
        <Link
          className="doctor-back"
          href={patientHref}
          aria-label="العودة لملف المريض"
        >
          <Icon name="arrow" size={20} />
        </Link>
      </header>
      {!completed && (
        <nav className="visit-tabs" aria-label="خطوات الزيارة">
          <Link aria-current={!plan ? "page" : undefined} href={visitHref}>
            القياسات والملاحظات
          </Link>
          <Link
            aria-current={plan ? "page" : undefined}
            href={`${visitHref}?step=plan`}
          >
            البرنامج والموعد
          </Link>
        </nav>
      )}
    </>
  );
}
