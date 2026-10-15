"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { accountForUser, homeForRole } from "@/lib/auth";

export type FormResult = { error: string; kind: "validation" | "credentials" | "service" } | null;

export async function signIn(_previous: FormResult, formData: FormData): Promise<FormResult> {
  const rawEmail = formData.get("email");
  const password = formData.get("password");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { kind: "validation", error: "أدخل بريداً إلكترونياً صالحاً." };
  }
  if (typeof password !== "string" || !password) {
    return { kind: "validation", error: "أدخل كلمة المرور." };
  }
  if (!isSupabaseConfigured()) {
    return { kind: "service", error: "خدمة الدخول غير متاحة حالياً. حاول لاحقاً." };
  }

  let destination: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      const serviceError = error?.status && (error.status >= 500 || error.status === 429);
      return {
        kind: serviceError ? "service" : "credentials",
        error: serviceError
          ? "تعذّر الاتصال بالخدمة. حاول مرة أخرى."
          : "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      };
    }

    const account = await accountForUser(supabase, data.user);
    if (!account) {
      await supabase.auth.signOut();
      return { kind: "credentials", error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
    }
    destination = account.mustChangePassword ? "/change-password" : homeForRole(account.role);
  } catch {
    return { kind: "service", error: "تعذّر الاتصال بالخدمة. حاول مرة أخرى." };
  }
  redirect(destination);
}

export async function changePassword(_previous: FormResult, formData: FormData): Promise<FormResult> {
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  const current = formData.get("currentPassword");
  if (typeof password !== "string" || password.length < 8) {
    return { kind: "validation", error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." };
  }
  if (password !== confirmation) {
    return { kind: "validation", error: "تأكيد كلمة المرور غير مطابق." };
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  const account = user && await accountForUser(supabase, user);
  if (error || !user || !account) redirect("/");
  if (!account.mustChangePassword && account.role !== "doctor") redirect(homeForRole(account.role));
  if (!account.mustChangePassword && (typeof current !== "string" || !current)) {
    return { kind: "validation", error: "أدخل كلمة المرور الحالية." };
  }
  if (account.mustChangePassword && !process.env.SUPABASE_SECRET_KEY) {
    return { kind: "service", error: "إعداد تغيير كلمة المرور غير مكتمل. تواصل مع مسؤول النظام." };
  }

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      ...(!account.mustChangePassword && typeof current === "string" ? { current_password: current } : {}),
    });
    if (updateError) return { kind: "service", error: "تعذّر تغيير كلمة المرور. تحقق من البيانات وحاول مجدداً." };

    if (account.mustChangePassword) {
      const admin = createAdminClient();
      const { error: flagError } = await admin.from("clinic_staff")
        .update({ must_change_password: false })
        .eq("user_id", user.id)
        .select("user_id")
        .single();
      if (flagError) return { kind: "service", error: "تغيّرت كلمة المرور، لكن تعذّر إكمال التفعيل. تواصل مع مسؤول النظام." };
    }
  } catch {
    return { kind: "service", error: "تعذّر الاتصال بالخدمة. حاول مرة أخرى." };
  }

  redirect(homeForRole(account.role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
