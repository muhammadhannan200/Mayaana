import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ClinicRole = "doctor" | "secretary";
export type ClinicAccount = { role: ClinicRole; mustChangePassword: boolean; clinicId: string };

export async function accountForUser(supabase: SupabaseClient, user: User): Promise<ClinicAccount | null> {
  const { data, error } = await supabase
    .from("clinic_staff")
    .select("clinic_id, role, login_email, must_change_password, active")
    .eq("user_id", user.id)
    .single();

  if (error || !data || !data.active || !user.email || data.login_email !== user.email.trim().toLowerCase()) return null;
  if (data.role !== "doctor" && data.role !== "secretary") return null;
  return {
    role: data.role,
    clinicId: data.clinic_id,
    mustChangePassword: data.must_change_password,
  };
}

export function homeForRole(role: ClinicRole) {
  return role === "doctor" ? "/doctor" : "/secretary";
}

export async function getCurrentAccount(): Promise<ClinicAccount | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  // The staff directory is administrator-managed and read through RLS.
  return accountForUser(supabase, user);
}
