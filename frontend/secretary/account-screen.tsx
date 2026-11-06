import {
  ProfileCard,
  ProfileNote,
  ProfileRow,
  ProfileSummary,
} from "@/frontend/components/profile-screen";
import { Icon } from "@/frontend/components/icon";
import { SignOutForm } from "@/frontend/auth/sign-out-form";
import type { AccountProfile } from "@/backend/account-profile";
import { DemoNote } from "./clinic-ui";

export function SecretaryAccount({
  profile,
  demoActions,
}: {
  profile?: AccountProfile | null;
  demoActions?: React.ReactNode;
}) {
  return (
    <div className="profile-screen">
      <h1>الحساب</h1>
      <ProfileSummary
        name={profile?.name ?? "سكرتيرة العيادة"}
        subtitle="سكرتيرة"
      />
      <ProfileCard>
        {profile?.email && (
          <ProfileRow
            icon="mail"
            label="البريد الإلكتروني"
            value={profile.email}
          />
        )}
        <ProfileRow icon="lock" label="كلمة المرور" value="••••••••" />
      </ProfileCard>
      <ProfileNote>
        نسيتِ كلمة المرور؟ تواصلي مع الطبيب لإعادة تعيينها.
      </ProfileNote>
      {demoActions ?? (
        <SignOutForm buttonClassName="profile-signout">
          <Icon name="logout" size={18} />
          تسجيل الخروج
        </SignOutForm>
      )}
    </div>
  );
}

export function DemoResetActions({
  onReset,
  doctorHref,
}: {
  onReset: () => void;
  doctorHref: string;
}) {
  return (
    <>
      <button
        className="secretary-outline"
        onClick={() => {
          if (
            window.confirm(
              "إعادة بيانات العرض الخيالية؟ ستُحذف تعديلات العرض في هذا المتصفح فقط."
            )
          ) {
            onReset();
          }
        }}
      >
        إعادة ضبط العرض التجريبي
      </button>
      <DemoNote demo href={doctorHref} />
    </>
  );
}
