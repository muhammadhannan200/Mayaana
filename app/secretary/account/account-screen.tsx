import { SignOutForm } from "@/app/sign-out-form";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "../components";
import { DoctorNav, SecretaryNav } from "../clinic-ui";
import "../secretary.css";
import "../persisted.css";

export function SecretaryAccountScreen({
  name,
  email,
  role = "secretary",
}: {
  name: string;
  email: string;
  role?: "secretary" | "doctor";
}) {
  const doctor = role === "doctor";
  return (
    <main className="secretary-shell persisted-clinic" dir="rtl">
      <div className="secretary-scroll">
        <header className="account-heading">
          <h1>الحساب</h1>
        </header>
        <div className="account-content">
          <section className="account-profile" aria-label="معلومات الحساب">
            <span className="account-initial" aria-hidden="true">
              {name[0]}
            </span>
            <div>
              <h2>{name}</h2>
              <p>{doctor ? "طبيب" : "سكرتيرة"} · حساب العيادة</p>
            </div>
          </section>
          <dl className="account-details">
            <div>
              <dt>البريد الإلكتروني</dt>
              <dd>
                <bdi>{email}</bdi>
              </dd>
            </div>
            <div>
              <dt>كلمة المرور</dt>
              <dd aria-label="كلمة المرور مخفية">••••••••</dd>
            </div>
          </dl>
          {doctor && (
            <div className="account-links">
              <Link className="secretary-outline" href="/change-password">
                تغيير كلمة المرور
              </Link>
              <Link className="secretary-outline" href="/doctor/staff">
                حساب السكرتيرة
              </Link>
            </div>
          )}
          <p className="account-recovery">
            <Icon name="info" size={16} />
            <span>
              {doctor
                ? "نسيت كلمة المرور؟ تواصل مع مسؤول النظام لإعادة تعيينها."
                : "نسيتِ كلمة المرور؟ اطلبي من الطبيب إعادة تعيينها. إلى أن تتوفر أداة إعادة التعيين، يتواصل الطبيب مع مسؤول النظام."}
            </span>
          </p>
          <SignOutForm buttonClassName="account-signout">
            <Image
              src="/rashaqa/account-logout.svg"
              width={18}
              height={18}
              alt=""
              unoptimized
            />
            تسجيل الخروج
          </SignOutForm>
        </div>
      </div>
      {doctor ? (
        <DoctorNav route="doctor/account" />
      ) : (
        <SecretaryNav route="secretary/account" />
      )}
    </main>
  );
}
