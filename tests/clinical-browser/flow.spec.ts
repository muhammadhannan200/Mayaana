import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const password = randomUUID() + "aA1!";
let secretaryEmail: string;
let doctorEmail: string;
let clinicId: string;
async function login(page: Page, email: string, role: string) {
  await page.goto("/");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL(`/${role}`);
}
async function surface(page: Page) {
  await expect(page.getByRole("main")).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1
    )
  ).toBe(true);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual(
    []
  );
}
test.beforeAll(async () => {
  if (
    process.env.CLINICAL_TEST_LOCAL !== "1" ||
    url !== "http://127.0.0.1:55431"
  )
    throw new Error("Isolated stack required");
  doctorEmail = `doctor-${randomUUID()}@browser.example.test`;
  secretaryEmail = `secretary-${randomUUID()}@browser.example.test`;
  const doctor = await admin.auth.admin.createUser({
    email: doctorEmail,
    password,
    email_confirm: true,
  });
  if (doctor.error) throw doctor.error;
  const secretary = await admin.auth.admin.createUser({
    email: secretaryEmail,
    password,
    email_confirm: true,
  });
  if (secretary.error) throw secretary.error;
  const clinic = await admin
    .from("clinics")
    .insert({
      name: "Synthetic browser clinic",
      doctor_user_id: doctor.data.user!.id,
    })
    .select("id")
    .single();
  if (clinic.error) throw clinic.error;
  clinicId = clinic.data.id;
  const staff = await admin.from("clinic_staff").insert([
    {
      user_id: doctor.data.user!.id,
      clinic_id: clinicId,
      role: "doctor",
      login_email: doctorEmail,
      display_name: "Synthetic doctor",
      active: true,
      must_change_password: false,
    },
    {
      user_id: secretary.data.user!.id,
      clinic_id: clinicId,
      role: "secretary",
      login_email: secretaryEmail,
      display_name: "Synthetic secretary",
      active: true,
      must_change_password: false,
    },
  ]);
  if (staff.error) throw staff.error;
});

test("two independent sessions: intake, handoff, private draft, diet, appointment, completion and reload", async ({
  browser,
}, info) => {
  const options = {
    viewport: info.project.use.viewport,
    baseURL: "http://127.0.0.1:3103",
  };
  const secretaryContext = await browser.newContext(options);
  const doctorContext = await browser.newContext(options);
  const secretary = await secretaryContext.newPage();
  const doctor = await doctorContext.newPage();
  const errors: string[] = [];
  for (const page of [secretary, doctor])
    page.on("pageerror", (error) => errors.push(error.message));
  for (const page of [secretary, doctor])
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().includes("net::ERR_FAILED")
      )
        errors.push(message.text());
    });
  try {
    await secretary.goto("/");
    await secretary.evaluate(
      (id) =>
        localStorage.setItem(
          `mayanaa-demo-v1:${id}`,
          "fictional legacy marker"
        ),
      clinicId
    );
    await login(secretary, secretaryEmail, "secretary");
    await expect(secretary.getByText("الدور فارغ الآن")).toBeVisible();
    expect(
      await secretary.evaluate(
        (id) => localStorage.getItem(`mayanaa-demo-v1:${id}`),
        clinicId
      )
    ).toBeNull();
    await surface(secretary);
    await login(doctor, doctorEmail, "doctor");
    await expect(
      doctor.getByText("لا يوجد مريض عند الطبيب الآن.")
    ).toBeVisible();
    await secretary
      .getByRole("link", { name: "إضافة مريض للدور", exact: true })
      .click();
    await secretary.getByRole("link", { name: /ملف.*جديد/ }).click();
    const patientName = "مريض اختباري طويل الاسم للتحقق من التخطيط العربي";
    await secretary
      .getByLabel("الاسم الكامل", { exact: false })
      .fill(patientName);
    await secretary
      .getByLabel("رقم الهاتف", { exact: false })
      .fill("+12025550121");
    await secretary.getByLabel("الطول", { exact: false }).fill("١٧٠");
    await secretary.getByLabel("سنة الميلاد").fill("١٩٩٠");
    await secretary
      .getByRole("button", { name: "حفظ ومتابعة الإضافة للدور" })
      .click();
    await expect(secretary).toHaveURL(/secretary\/confirm/);
    await surface(secretary);
    const patientId = new URL(secretary.url()).searchParams.get("patient")!;
    await secretary
      .getByRole("button", { name: "إضافة للدور", exact: true })
      .click();
    await expect(secretary).toHaveURL(/secretary\?added=1/);
    await secretary.reload();
    await secretary.getByRole("link", { name: "أخذ القياس" }).click();
    const values: Record<string, string> = {
      الوزن: "٨٠",
      "نسبة الدهون": "٢٠",
      "الكتلة العضلية": "٣٠",
      "الدهون الحشوية": "٧",
      "الحرق الأساسي": "١٦٠٠",
      الخصر: "٨٥",
      الذراع: "٣٠",
      الفخذ: "٥٠",
      الورك: "١٠٠",
    };
    for (const [label, value] of Object.entries(values))
      await secretary
        .getByRole("textbox", { name: label, exact: true })
        .fill(value);
    // Abort only this browser's server-action request. No application test mode.
    await secretary.route("**/secretary/measurements/full-exam*", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue()
    );
    await secretary.getByRole("button", { name: /حفظ القياسات/ }).click();
    await expect(secretary.locator("p[role=alert]")).toContainText(
      "تعذّر الاتصال"
    );
    await expect(
      secretary.getByRole("textbox", { name: "الوزن", exact: true })
    ).toHaveValue("٨٠");
    await secretary.unrouteAll();
    await secretary.getByRole("button", { name: /حفظ القياسات/ }).click();
    await expect(secretary).toHaveURL(/measured=1/);
    await secretary.reload();
    await expect(
      secretary.getByRole("button", { name: "إدخال عند الطبيب" })
    ).toBeVisible();
    await surface(secretary);
    await secretary.getByRole("button", { name: "إدخال عند الطبيب" }).click();
    await expect(
      doctor.locator(".doctor-queue").filter({ hasText: "عند الطبيب" })
    ).toContainText(patientName, { timeout: 25_000 });
    await doctor.getByRole("link", { name: "فتح الملف", exact: true }).click();
    await expect(doctor.locator(".demo-measurements")).toContainText("80");
    await doctor
      .getByRole("link", { name: "زيارة اليوم", exact: true })
      .click();
    await doctor
      .getByLabel("ملاحظاتي")
      .fill("ملاحظة خاصة اختباريّة لا تظهر للسكرتيرة");
    await doctor
      .getByRole("button", { name: "حفظ المسودة", exact: true })
      .click();
    await expect(doctor.locator(".clinical-draft")).toContainText(
      "النسخة المحفوظة"
    );
    await doctor.reload();
    await expect(doctor.getByLabel("ملاحظاتي")).toHaveValue(
      "ملاحظة خاصة اختباريّة لا تظهر للسكرتيرة"
    );
    await surface(doctor);
    await doctor.getByRole("link", { name: "متابعة للبرنامج والموعد" }).click();
    await doctor
      .getByRole("button", { name: "إضافة يوم", exact: true })
      .click();
    await doctor
      .getByRole("button", { name: "إضافة وجبة", exact: true })
      .click();
    await doctor
      .getByLabel("تفاصيل الوجبة")
      .fill("بيض وخبز وخضار — بيانات اختبارية");
    await doctor
      .getByRole("button", { name: "إضافة الوجبة", exact: true })
      .click();
    const appointment = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    await doctor.getByLabel("تاريخ الموعد").fill(appointment);
    await doctor
      .getByRole("button", { name: "حفظ المسودة", exact: true })
      .click();
    await expect(doctor.locator(".clinical-draft")).toContainText(
      "النسخة المحفوظة"
    );
    await doctor.reload();
    await expect(doctor.locator(".visit-meal")).toContainText("بيض وخبز");
    await expect(doctor.getByLabel("تاريخ الموعد")).toHaveValue(appointment);
    await surface(doctor);
    await doctor
      .getByRole("button", { name: "إنهاء الزيارة", exact: true })
      .focus();
    await doctor.keyboard.press("Enter");
    await expect(doctor.getByRole("dialog").locator(":focus")).toHaveCount(1);
    await doctor.keyboard.press("Escape");
    await expect(doctor.getByRole("dialog")).toHaveCount(0);
    await doctor.keyboard.press("Enter");
    await expect(doctor.getByRole("dialog")).toContainText(patientName);
    await surface(doctor);
    await doctor
      .getByRole("button", { name: "حفظ وإنهاء الزيارة", exact: true })
      .click();
    await expect(
      doctor.getByRole("heading", { name: "الزيارة المكتملة", exact: true })
    ).toBeVisible();
    await doctor.reload();
    await expect(doctor.getByLabel("ملاحظاتي")).toHaveValue(
      "ملاحظة خاصة اختباريّة لا تظهر للسكرتيرة"
    );
    await expect(doctor.getByLabel("ملاحظاتي")).toHaveAttribute("readonly", "");
    await expect(doctor.locator(".visit-meal")).toContainText("بيض وخبز");
    await expect(
      secretary.locator(".doctor-card").filter({ hasText: patientName })
    ).toContainText("اكتملت الزيارة", { timeout: 25_000 });
    await secretary.reload();
    await expect(
      secretary.locator(".doctor-card").filter({ hasText: patientName })
    ).toContainText("اكتملت الزيارة");
    await secretary.goto(`/secretary/search`);
    await secretary.getByLabel("اسم المريض أو رقم هاتفه").fill("+12025550121");
    await expect(
      secretary.getByRole("link", { name: new RegExp(patientName) })
    ).toBeVisible();
    expect(
      await secretary.evaluate(() =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith("mayanaa-demo-v1:")
        )
      )
    ).toEqual([]);
    expect(
      await doctor.evaluate(() =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith("mayanaa-demo-v1:")
        )
      )
    ).toEqual([]);
    const patient = await admin
      .from("patients")
      .select("id,full_name")
      .eq("clinic_id", clinicId)
      .eq("id", patientId)
      .single();
    expect(patient.data?.full_name).toBe(patientName);
    await doctor.screenshot({
      path: info.outputPath("completed.png"),
      fullPage: true,
    });
    await surface(doctor);
    expect(errors).toEqual([]);
  } finally {
    await secretaryContext.close();
    await doctorContext.close();
  }
});

test("independent doctor sessions reject stale drafts and never present unsaved data as a completed record", async ({
  browser,
}, info) => {
  const api = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } }
  );
  const signed = await api.auth.signInWithPassword({
    email: doctorEmail,
    password,
  });
  if (signed.error) throw signed.error;
  async function rpc(name: string, args: Record<string, unknown>) {
    const result = await api.rpc(name, args);
    if (result.error) throw result.error;
    return result.data;
  }
  const id = randomUUID();
  await rpc("clinical_create_patient", {
    p_id: id,
    p_clinic: clinicId,
    p_name: "مريض تعارض الجلسات",
    p_phone: "+12025550123",
    p_height: 170,
    p_gender: "male",
    p_birth_year: 1990,
    p_goal: "نقص وزن",
  });
  let queue = await rpc("clinical_enqueue", {
    p_clinic: clinicId,
    p_patient: id,
    p_kind: "follow_up",
  });
  queue = await rpc("clinical_save_measurements", {
    p_queue: queue.id,
    p_revision: queue.revision,
    p_values: { weight: 80 },
  });
  queue = await rpc("clinical_handoff", {
    p_queue: queue.id,
    p_revision: queue.revision,
    p_request: randomUUID(),
  });
  const contexts = await Promise.all([
    browser.newContext({
      viewport: info.project.use.viewport,
      baseURL: "http://127.0.0.1:3103",
    }),
    browser.newContext({
      viewport: info.project.use.viewport,
      baseURL: "http://127.0.0.1:3103",
    }),
  ]);
  try {
    const first = await contexts[0].newPage();
    const second = await contexts[1].newPage();
    for (const page of [first, second]) {
      await login(page, doctorEmail, "doctor");
      await page.goto(`/doctor/visits/${queue.id}`);
      await expect(page.getByLabel("ملاحظاتي")).toBeVisible();
    }
    await first.getByLabel("ملاحظاتي").fill("مسودة محلية غير محفوظة");
    await second.getByLabel("ملاحظاتي").fill("النسخة المحفوظة من الجهاز الآخر");
    await second
      .getByRole("button", { name: "حفظ المسودة", exact: true })
      .click();
    await expect(second.locator(".clinical-draft")).toContainText(
      "النسخة المحفوظة"
    );
    await first.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(first.locator(".clinical-draft")).toContainText(
      "تغيّرت الزيارة في جلسة أخرى"
    );
    await expect(first.getByLabel("ملاحظاتي")).toHaveValue(
      "مسودة محلية غير محفوظة"
    );
    await expect(
      first.getByRole("button", { name: "حفظ المسودة", exact: true })
    ).toBeDisabled();
    first.once("dialog", (dialog) => dialog.accept());
    await first
      .getByRole("button", { name: "تحميل النسخة المحفوظة وإلغاء تعديلاتي" })
      .click();
    await expect(first.getByLabel("ملاحظاتي")).toHaveValue(
      "النسخة المحفوظة من الجهاز الآخر"
    );
    await first
      .getByLabel("ملاحظاتي")
      .fill("مسودة ثانية يجب ألا تظهر كسجل مكتمل");
    const current = await api
      .from("daily_queue")
      .select("revision")
      .eq("id", queue.id)
      .single();
    if (current.error) throw current.error;
    await rpc("clinical_finish", {
      p_queue: queue.id,
      p_revision: current.data.revision,
      p_request: randomUUID(),
      p_notes: "الملاحظات النهائية المعتمدة",
      p_days: [
        {
          id: randomUUID(),
          meals: [
            { id: randomUUID(), type: "فطور", description: "وجبة اختبار" },
          ],
        },
      ],
      p_appointment: null,
    });
    await first.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      first.getByRole("heading", { name: "الزيارة المكتملة", exact: true })
    ).toBeVisible();
    await expect(first.getByLabel("ملاحظاتي", { exact: true })).toHaveValue(
      "الملاحظات النهائية المعتمدة"
    );
    await expect(
      first.getByText("أُغلقت الزيارة في جلسة أخرى.", { exact: false })
    ).toBeVisible();
    await first
      .getByText("ملاحظات مسودتي غير المحفوظة", { exact: true })
      .click();
    await expect(first.getByLabel("ملاحظات المسودة غير المحفوظة")).toHaveValue(
      "مسودة ثانية يجب ألا تظهر كسجل مكتمل"
    );
  } finally {
    for (const context of contexts) await context.close();
    await api.auth.signOut();
  }
});
