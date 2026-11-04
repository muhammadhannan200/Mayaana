import { redirect } from "next/navigation";
import { LoginForm } from "@/frontend/auth/login-form";
import { getCurrentAccount, homeForRole } from "@/backend/auth";
import { isSupabaseConfigured } from "@/backend/supabase/server";

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
