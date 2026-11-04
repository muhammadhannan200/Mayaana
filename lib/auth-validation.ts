export type AuthField =
  "email" | "password" | "currentPassword" | "confirmation";
export type FieldErrors = Partial<Record<AuthField, string>>;
export type FormResult =
  | {
      error: string;
      kind: "validation";
      fieldErrors: FieldErrors;
    }
  | {
      error: string;
      kind: "credentials" | "service";
    }
  | null;

function text(data: FormData, name: AuthField) {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

export function validateLogin(data: FormData): FieldErrors {
  const errors: FieldErrors = {};
  const email = text(data, "email").trim();
  if (!email) errors.email = "أدخل البريد الإلكتروني.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "أدخل بريداً إلكترونياً صالحاً مثل name@example.com.";
  if (!text(data, "password")) errors.password = "أدخل كلمة المرور.";
  return errors;
}

export function validatePassword(
  data: FormData,
  requireCurrent = false
): FieldErrors {
  const errors: FieldErrors = {};
  const password = text(data, "password");
  const confirmation = text(data, "confirmation");
  if (requireCurrent && !text(data, "currentPassword"))
    errors.currentPassword = "أدخل كلمة المرور الحالية.";
  if (!password) errors.password = "أدخل كلمة المرور الجديدة.";
  else if (password.length < 8)
    errors.password = "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.";
  if (!confirmation) errors.confirmation = "أدخل تأكيد كلمة المرور.";
  else if (password !== confirmation)
    errors.confirmation = "تأكيد كلمة المرور غير مطابق.";
  return errors;
}

export function validationResult(fieldErrors: FieldErrors): FormResult {
  const error = Object.values(fieldErrors)[0];
  return error ? { kind: "validation", error, fieldErrors } : null;
}
