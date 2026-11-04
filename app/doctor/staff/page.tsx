import { redirect } from "next/navigation";
import { getCurrentAccount, homeForRole } from "@/backend/auth";
import { createClient } from "@/backend/supabase/server";
import { getAccountProfile } from "@/backend/account-profile";
import {
  ProfileCard,
  ProfileRow,
  ProfileSummary,
} from "@/frontend/components/profile-screen";
import { Icon } from "@/frontend/components/icon";
import { SignOutForm } from "@/frontend/auth/sign-out-form";
import { DoctorNav } from "../../../frontend/doctor/doctor-nav";
import "@/frontend/secretary/secretary.css";
import "../../../frontend/doctor/workspace.css";

export const instant = false;

export default async function ClinicStaffPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/");
  if (account.mustChangePassword) redirect("/change-password");
  if (account.role !== "doctor") redirect(homeForRole(account.role));

  const supabase = await createClient();
  const [profile, { data: staff, error }] = await Promise.all([
    getAccountProfile(),
    supabase
      .from("clinic_staff")
      .select("user_id, display_name, role, active, must_change_password")
      .eq("clinic_id", account.clinicId)
      .order("created_at", { ascending: true }),
  ]);
  const secretaries = staff?.filter((member) => member.role !== "doctor") ?? [];

  return (
    <main className="doctor-shell doctor-workspace" dir="rtl">
      <div className="doctor-scroll">
        <div className="profile-screen">
          <h1>الحساب</h1>
          <ProfileSummary name={profile?.name ?? "الطبيب"} subtitle="طبيب" />
          <h2 className="profile-section-title">الحساب</h2>
          <ProfileCard>
            {profile?.email && (
              <ProfileRow
                icon="mail"
                label="البريد الإلكتروني"
                value={profile.email}
              />
            )}
            <ProfileRow
              icon="lock"
              label="كلمة المرور"
              value="••••••••"
              href="/change-password"
            />
          </ProfileCard>
          <h2 className="profile-section-title">العيادة</h2>
          {error ? (
            <p className="message message-error" role="alert">
              تعذّر تحميل الحسابات. حاول مرة أخرى.
            </p>
          ) : (
            <ProfileCard>
              {secretaries.length === 0 ? (
                <ProfileRow icon="account" label="لا يوجد حساب سكرتيرة" />
              ) : (
                secretaries.map((member) => (
                  <ProfileRow
                    key={member.user_id}
                    icon="account"
                    label={member.display_name}
                    value={
                      !member.active
                        ? "موقوف"
                        : member.must_change_password
                          ? "ينتظر تعيين كلمة مرور"
                          : "نشط"
                    }
                  />
                ))
              )}
            </ProfileCard>
          )}
          <SignOutForm buttonClassName="profile-signout">
            <Icon name="logout" size={18} />
            تسجيل الخروج
          </SignOutForm>
        </div>
      </div>
      <DoctorNav route="doctor/staff" />
    </main>
  );
}
