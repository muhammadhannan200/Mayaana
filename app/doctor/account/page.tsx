import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAccount } from "@/lib/auth";
import { SecretaryAccountScreen } from "@/app/secretary/account/account-screen";

export const instant = false;
export default async function Page() {
  const account = await getCurrentAccount();
  if (!account || account.role !== "doctor" || account.mustChangePassword)
    redirect("/");
  const db = await createClient();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) redirect("/");
  const { data, error } = await db
    .from("clinic_staff")
    .select("display_name, login_email")
    .eq("user_id", user.id)
    .single();
  if (error || !data) throw new Error("تعذّر تحميل معلومات الحساب.");
  return (
    <SecretaryAccountScreen
      role="doctor"
      name={data.display_name}
      email={data.login_email}
    />
  );
}
