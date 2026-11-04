import {
  ProfileCard,
  ProfileNote,
  ProfileRow,
  ProfileSummary,
} from "@/components/profile-screen";
import { Icon } from "@/components/icon";
import { SignOutForm } from "@/app/sign-out-form";
import type { AccountProfile } from "@/lib/account-profile";

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
