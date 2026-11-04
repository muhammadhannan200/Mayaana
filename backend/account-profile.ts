import "server-only";
import { createClient } from "./supabase/server";

export type AccountProfile = { name: string; email: string };

export async function getAccountProfile(): Promise<AccountProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data } = await supabase
    .from("clinic_staff")
    .select("display_name, login_email")
    .eq("user_id", user.id)
    .maybeSingle();
  return data ? { name: data.display_name, email: data.login_email } : null;
}
