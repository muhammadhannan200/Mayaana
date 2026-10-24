import { redirect } from "next/navigation";
import { getCurrentAccount, homeForRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { SignOutForm } from "@/app/sign-out-form";
import "./doctor.css";

export const instant = false;

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) redirect("/");
  const account = await getCurrentAccount();
  if (!account) redirect("/");
  if (account.mustChangePassword) redirect("/change-password");
  if (account.role !== "doctor") redirect(homeForRole(account.role));
  return (
    <>
      <header className="doctor-home-header" aria-label="الحساب">
        <SignOutForm />
      </header>
      {children}
    </>
  );
}
