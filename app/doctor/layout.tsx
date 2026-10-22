import { redirect } from "next/navigation";
import { getCurrentAccount, homeForRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { DemoClinicProvider } from "@/lib/demo-clinic";
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
    <DemoClinicProvider scope={account.clinicId}>{children}</DemoClinicProvider>
  );
}
