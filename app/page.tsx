import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login-form";
import { getCurrentAccount, homeForRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const instant = false;

export default async function Home() {
  if (isSupabaseConfigured()) {
    const account = await getCurrentAccount();
    if (account) {
      redirect(account.mustChangePassword ? "/change-password" : homeForRole(account.role));
    }
  }

  return <LoginForm configured={isSupabaseConfigured()} />;
}
