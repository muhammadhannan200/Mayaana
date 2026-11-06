import Link from "next/link";
import { Icon } from "@/frontend/components/icon";

export function VisitActionBar({
  completed,
  plan,
  homeHref,
  visitHref,
  whatsappLink,
  disabled,
  onFinish,
}: {
  completed: boolean;
  plan: boolean;
  homeHref: string;
  visitHref: string;
  whatsappLink?: string | null;
  disabled?: boolean;
  onFinish: () => void;
}) {
  return (
    <footer
      className={`visit-actionbar${completed ? " visit-actionbar-done" : ""}`}
    >
      {completed ? (
        <>
          <Link className="secretary-outline" href={homeHref}>
            العودة للرئيسية
          </Link>
          {whatsappLink && (
            <a
              className="secretary-primary"
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              إرسال عبر واتساب
            </a>
          )}
        </>
      ) : !plan ? (
        <Link className="secretary-primary" href={`${visitHref}?step=plan`}>
          متابعة للبرنامج والموعد
        </Link>
      ) : (
        <button
          className="secretary-primary"
          disabled={disabled}
          onClick={onFinish}
        >
          <Icon name="check" size={20} />
          إنهاء الزيارة
        </button>
      )}
    </footer>
  );
}

export function VisitUnavailable({ homeHref }: { homeHref: string }) {
  return (
    <main className="doctor-shell recovery" dir="rtl">
      <h1>الزيارة غير متاحة</h1>
      <p>أكمل القياسات وأدخل المريض عند الطبيب أولاً.</p>
      <Link className="secretary-primary" href={homeHref}>
        العودة للرئيسية
      </Link>
    </main>
  );
}
