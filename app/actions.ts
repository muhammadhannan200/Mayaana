"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AuthError } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { accountForUser, homeForRole } from "@/lib/auth";
import {
  validateLogin,
  validatePassword,
  validationResult,
  type FormResult,
} from "@/lib/auth-validation";
export type { FormResult } from "@/lib/auth-validation";

const credentialsError: FormResult = {
  kind: "credentials",
  error: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
};
const serviceError: FormResult = {
  kind: "service",
  error: "تعذّر الاتصال بالخدمة. حاول مرة أخرى.",
};

function isServiceError(error: AuthError) {
  return (
    error.name === "AuthRetryableFetchError" ||
    error.code === "request_timeout" ||
    error.code === "unexpected_failure" ||
    error.status === 429 ||
    (error.status !== undefined && error.status >= 500)
  );
}

export async function signIn(
  _previous: FormResult,
  formData: FormData
): Promise<FormResult> {
  const rawEmail = formData.get("email");
  const password = formData.get("password");
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  const invalid = validationResult(validateLogin(formData));
  if (invalid) return invalid;
  // Keep the runtime type guard at the authentication boundary.
  if (typeof password !== "string") return serviceError;
  if (!isSupabaseConfigured()) {
    return {
      kind: "service",
      error: "خدمة الدخول غير متاحة حالياً. حاول لاحقاً.",
    };
  }

  let destination: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return isServiceError(error) ? serviceError : credentialsError;
    if (!data.user) return serviceError;

    let account;
    try {
      account = await accountForUser(supabase, data.user);
    } catch {
      await supabase.auth.signOut();
      return serviceError;
    }
    if (!account) {
      await supabase.auth.signOut();
      return credentialsError;
    }
    destination = account.mustChangePassword
      ? "/change-password"
      : homeForRole(account.role);
  } catch {
    return serviceError;
  }
  redirect(destination);
}

export async function changePassword(
  _previous: FormResult,
  formData: FormData
): Promise<FormResult> {
  const password = formData.get("password");
  const current = formData.get("currentPassword");
  // Include the current field when rendered/submitted so missing-field focus
  // follows DOM order. Omitting it cannot bypass the account-based check below.
  const invalid = validationResult(
    validatePassword(formData, formData.has("currentPassword"))
  );
  if (invalid) return invalid;
  if (typeof password !== "string") return serviceError;

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let user;
  let account;
  try {
    supabase = await createClient();
    const result = await supabase.auth.getUser();
    if (result.error && isServiceError(result.error)) return serviceError;
    user = result.error ? null : result.data.user;
    account = user && (await accountForUser(supabase, user));
  } catch {
    return serviceError;
  }
  // Keep redirect control flow outside the service-error catch.
  if (!user || !account) redirect("/");
  if (!account.mustChangePassword && account.role !== "doctor")
    redirect(homeForRole(account.role));
  if (
    !account.mustChangePassword &&
    (typeof current !== "string" || !current)
  ) {
    return validationResult({ currentPassword: "أدخل كلمة المرور الحالية." });
  }
  if (account.mustChangePassword && !process.env.SUPABASE_SECRET_KEY) {
    return {
      kind: "service",
      error: "إعداد تغيير كلمة المرور غير مكتمل. تواصل مع مسؤول النظام.",
    };
  }

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      ...(!account.mustChangePassword && typeof current === "string"
        ? { current_password: current }
        : {}),
    });
    if (updateError)
      return {
        kind: "service",
        error: "تعذّر تغيير كلمة المرور. تحقق من البيانات وحاول مجدداً.",
      };

    if (account.mustChangePassword) {
      const admin = createAdminClient();
      const { error: flagError } = await admin
        .from("clinic_staff")
        .update({ must_change_password: false })
        .eq("user_id", user.id)
        .select("user_id")
        .single();
      if (flagError)
        return {
          kind: "service",
          error:
            "تغيّرت كلمة المرور، لكن تعذّر إكمال التفعيل. تواصل مع مسؤول النظام.",
        };
    }
  } catch {
    return { kind: "service", error: "تعذّر الاتصال بالخدمة. حاول مرة أخرى." };
  }

  redirect(homeForRole(account.role));
}

export async function signOut(): Promise<FormResult> {
  try {
    // auth-js clears local storage even on a logout service failure. Do not
    // expire the browser session until remote revocation actually succeeds:
    // otherwise the protected-page rerender redirects before showing the error.
    const cookieWrites: Array<() => void> = [];
    const supabase = await createClient({
      deferCookieWrite: (commit) => cookieWrites.push(commit),
    });
    const { error } = await supabase.auth.signOut();
    if (error)
      return { kind: "service", error: "تعذّر تسجيل الخروج. حاول مرة أخرى." };
    cookieWrites.forEach((commit) => commit());
  } catch {
    return { kind: "service", error: "تعذّر تسجيل الخروج. حاول مرة أخرى." };
  }
  revalidatePath("/", "layout");
  redirect("/");
}
