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
    console.log("STEP 1 line 109", Date.now());
    await secretary.goto("/");
    console.log("STEP 2 line 110", Date.now());
    await secretary.evaluate(
      (id) =>
        localStorage.setItem(
          `mayanaa-demo-v1:${id}`,
          "fictional legacy marker"
        ),
      clinicId
    );
    console.log("STEP 3 line 118", Date.now());
    await login(secretary, secretaryEmail, "secretary");
    console.log("STEP 4 line 119", Date.now());
    await expect(secretary.getByText("الدور فارغ الآن")).toBeVisible();
    console.log("STEP 5 line 120", Date.now());
    await expect(
      secretary.getByRole("heading", { name: /متوقع اليوم|متأخر/ })
    ).toHaveCount(0);
    expect(
      await secretary.evaluate(
        (id) => localStorage.getItem(`mayanaa-demo-v1:${id}`),
        clinicId
      )
    ).toBeNull();
    console.log("STEP 6 line 129", Date.now());
    await surface(secretary);
    console.log("STEP 7 line 130", Date.now());
    await login(doctor, doctorEmail, "doctor");
    console.log("STEP 8 line 131", Date.now());
    await expect(
      doctor.getByText("لا يوجد مريض عند الطبيب الآن.")
    ).toBeVisible();
    console.log("STEP 9 line 134", Date.now());
    await expect(
      doctor.getByText("لا يوجد مرضى متوقعون اليوم لم يصلوا بعد.")
    ).toBeVisible();
    console.log("STEP 10 line 137", Date.now());
    await expect(
      doctor.getByText("لا توجد مواعيد متأخرة دون زيارة مكتملة أو موعد لاحق.")
    ).toBeVisible();
    console.log("STEP 11 line 140", Date.now());
    await secretary
      .getByRole("link", { name: "إضافة مريض للدور", exact: true })
      .click();
    console.log("STEP 12 line 143", Date.now());
    await secretary.getByRole("link", { name: /ملف.*جديد/ }).click();
    const patientName = "مريض اختباري طويل الاسم للتحقق من التخطيط العربي";
    console.log("STEP 13 line 145", Date.now());
    await secretary
      .getByLabel("الاسم الكامل", { exact: false })
      .fill(patientName);
    console.log("STEP 14 line 148", Date.now());
    await secretary
      .getByLabel("رقم الهاتف", { exact: false })
      .fill("+12025550121");
    console.log("STEP 15 line 151", Date.now());
    await secretary.getByLabel("الطول", { exact: false }).fill("١٧٠");
    console.log("STEP 16 line 152", Date.now());
    await secretary.getByLabel("سنة الميلاد").fill("١٩٩٠");
    console.log("STEP 17 line 153", Date.now());
    await secretary
      .getByRole("button", { name: "حفظ ومتابعة الإضافة للدور" })
      .click();
    console.log("STEP 18 line 156", Date.now());
    await expect(secretary).toHaveURL(/secretary\/confirm/);
    console.log("STEP 19 line 157", Date.now());
    await surface(secretary);
    const patientId = new URL(secretary.url()).searchParams.get("patient")!;
    console.log("STEP 20 line 159", Date.now());
    await secretary
      .getByRole("button", { name: "إضافة للدور", exact: true })
      .click();
    console.log("STEP 21 line 162", Date.now());
    await expect(secretary).toHaveURL(/secretary\?added=1/);
    console.log("STEP 22 line 163", Date.now());
    await secretary.reload();
    console.log("STEP 23 line 164", Date.now());
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
    // Lose the response AFTER the real transaction commits. Retrying must use
    // the original request identity, not fail stale or write measurements twice.
    console.log("STEP 24 line 182", Date.now());
    await secretary.route(
      "**/secretary/measurements/full-exam*",
      async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        await route.fetch();
        await route.abort();
      }
    );
    console.log("STEP 25 line 190", Date.now());
    await secretary.getByRole("button", { name: /حفظ القياسات/ }).click();
    console.log("STEP 26 line 191", Date.now());
    await expect(secretary.locator("p[role=alert]")).toContainText(
      "تعذّر الاتصال"
    );
    console.log("STEP 27 line 194", Date.now());
    await expect(
      secretary.getByRole("textbox", { name: "الوزن", exact: true })
    ).toHaveValue("٨٠");
    const committed = await admin
      .from("daily_queue")
      .select("revision,status")
      .eq("patient_id", patientId)
      .single();
    expect(committed.error).toBeNull();
    expect(committed.data).toMatchObject({ revision: 1, status: "ready" });
    console.log("STEP 28 line 204", Date.now());
    await secretary.unrouteAll();
    console.log("STEP 29 line 205", Date.now());
    await secretary.getByRole("button", { name: /حفظ القياسات/ }).click();
    console.log("STEP 30 line 206", Date.now());
    await expect(secretary).toHaveURL(/measured=1/);
    const retried = await admin
      .from("daily_queue")
      .select("revision,status")
      .eq("patient_id", patientId)
      .single();
    expect(retried.error).toBeNull();
    expect(retried.data).toEqual(committed.data);
    console.log("STEP 31 line 214", Date.now());
    await secretary.reload();
    console.log("STEP 32 line 215", Date.now());
    await expect(
      secretary.getByRole("button", { name: "إدخال عند الطبيب" })
    ).toBeVisible();
    console.log("STEP 33 line 218", Date.now());
    await surface(secretary);
    console.log("STEP 34 line 219", Date.now());
    await secretary.getByRole("button", { name: "إدخال عند الطبيب" }).click();
    console.log("STEP 35 line 220", Date.now());
    await expect(doctor.locator(".doctor-current")).toContainText(patientName, {
      timeout: 25_000,
    });
    console.log("STEP 36 line 223", Date.now());
    await doctor.getByRole("link", { name: "فتح الملف", exact: true }).click();
    console.log("STEP 37 line 224", Date.now());
    await expect(doctor.locator(".patient-progress")).toContainText("80");
    console.log("STEP 38 line 225", Date.now());
    await doctor
      .getByRole("link", { name: "فتح زيارة اليوم", exact: true })
      .click();
    console.log("STEP 39 line 228", Date.now());
    await doctor
      .getByLabel("ملاحظاتي")
      .fill("ملاحظة خاصة اختباريّة لا تظهر للسكرتيرة");
    console.log("STEP 40 line 231", Date.now());
    await doctor
      .getByRole("button", { name: "حفظ المسودة", exact: true })
      .click();
    console.log("STEP 41 line 234", Date.now());
    await expect(doctor.locator(".clinical-draft")).toContainText(
      "النسخة المحفوظة"
    );
    console.log("STEP 42 line 237", Date.now());
    await doctor.reload();
    console.log("STEP 43 line 238", Date.now());
    await expect(doctor.getByLabel("ملاحظاتي")).toHaveValue(
      "ملاحظة خاصة اختباريّة لا تظهر للسكرتيرة"
    );
    console.log("STEP 44 line 241", Date.now());
    await surface(doctor);
    console.log("STEP 45 line 242", Date.now());
    await doctor.getByRole("link", { name: "متابعة للبرنامج والموعد" }).click();
    console.log("STEP 46 line 243", Date.now());
    await doctor
      .getByRole("button", { name: "إضافة يوم", exact: true })
      .click();
    console.log("STEP 47 line 246", Date.now());
    await doctor
      .getByRole("button", { name: "إضافة وجبة", exact: true })
      .click();
    console.log("STEP 48 line 249", Date.now());
    await doctor
      .getByLabel("تفاصيل الوجبة")
      .fill("بيض وخبز وخضار — بيانات اختبارية");
    console.log("STEP 49 line 252", Date.now());
    await doctor
      .getByRole("button", { name: "إضافة الوجبة", exact: true })
      .click();
    const appointment = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    console.log("STEP 50 line 258", Date.now());
    await doctor.getByLabel("تاريخ الموعد").fill(appointment);
    console.log("STEP 51 line 259", Date.now());
    await doctor
      .getByRole("button", { name: "حفظ المسودة", exact: true })
      .click();
    console.log("STEP 52 line 262", Date.now());
    await expect(doctor.locator(".clinical-draft")).toContainText(
      "النسخة المحفوظة"
    );
    console.log("STEP 53 line 265", Date.now());
    await doctor.reload();
    console.log("STEP 54 line 266", Date.now());
    await expect(doctor.locator(".visit-meal")).toContainText("بيض وخبز");
    console.log("STEP 55 line 267", Date.now());
    await expect(doctor.getByLabel("تاريخ الموعد")).toHaveValue(appointment);
    console.log("STEP 56 line 268", Date.now());
    await surface(doctor);
    console.log("STEP 57 line 269", Date.now());
    await doctor
      .getByRole("button", { name: "إنهاء الزيارة", exact: true })
      .focus();
    console.log("STEP 58 line 272", Date.now());
    await doctor.keyboard.press("Enter");
    console.log("STEP 59 line 273", Date.now());
    await expect(doctor.getByRole("dialog").locator(":focus")).toHaveCount(1);
    console.log("STEP 60 line 274", Date.now());
    await doctor.keyboard.press("Escape");
    console.log("STEP 61 line 275", Date.now());
    await expect(doctor.getByRole("dialog")).toHaveCount(0);
    console.log("STEP 62 line 276", Date.now());
    await doctor.keyboard.press("Enter");
    console.log("STEP 63 line 277", Date.now());
    await expect(doctor.getByRole("dialog")).toContainText(patientName);
    console.log("STEP 64 line 278", Date.now());
    await surface(doctor);
    console.log("STEP 65 line 279", Date.now());
    await doctor
      .getByRole("button", { name: "حفظ وإنهاء الزيارة", exact: true })
      .click();
    console.log("STEP 66 line 282", Date.now());
    await expect(
      doctor.getByRole("heading", { name: "الزيارة المكتملة", exact: true })
    ).toBeVisible();
    console.log("STEP 67 line 285", Date.now());
    await doctor.reload();
    console.log("STEP 68 line 286", Date.now());
    await expect(doctor.getByLabel("ملاحظاتي")).toHaveValue(
      "ملاحظة خاصة اختباريّة لا تظهر للسكرتيرة"
    );
    console.log("STEP 69 line 289", Date.now());
    await expect(doctor.getByLabel("ملاحظاتي")).toHaveAttribute("readonly", "");
    console.log("STEP 70 line 290", Date.now());
    await expect(doctor.locator(".visit-meal")).toContainText("بيض وخبز");
    console.log("STEP 71 line 291", Date.now());
    await expect(
      secretary.locator(".doctor-card").filter({ hasText: patientName })
    ).toContainText("اكتملت الزيارة", { timeout: 25_000 });
    console.log("STEP 72 line 294", Date.now());
    await secretary.reload();
    console.log("STEP 73 line 295", Date.now());
    await expect(
      secretary.locator(".doctor-card").filter({ hasText: patientName })
    ).toContainText("اكتملت الزيارة");
    console.log("STEP 74 line 298", Date.now());
    await secretary.goto(`/secretary/search`);
    console.log("STEP 75 line 299", Date.now());
    await secretary.getByLabel("اسم المريض أو رقم هاتفه").fill("+12025550121");
    console.log("STEP 76 line 300", Date.now());
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
    console.log("STEP 77 line 324", Date.now());
    await doctor.screenshot({
      path: info.outputPath("completed.png"),
      fullPage: true,
    });
    console.log("STEP 78 line 328", Date.now());
    await surface(doctor);
    expect(errors).toEqual([]);
  } finally {
    await secretaryContext.close();
    await doctorContext.close();
  }
});

test("competing Secretary sessions show a clear occupied conflict, refresh, and unblock after Doctor completion", async ({
  browser,
}, info) => {
  const secretaryApi = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } }
  );
  const doctorApi = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } }
  );
  const contexts = await Promise.all(
    [0, 1, 2].map(() =>
      browser.newContext({
        baseURL: "http://127.0.0.1:3103",
        viewport: info.project.use.viewport,
      })
    )
  );
  const entries: { id: string; revision: number }[] = [];
  const plan = [
    {
      id: randomUUID(),
      meals: [
        { id: randomUUID(), type: "فطور", description: "Synthetic meal" },
      ],
    },
  ];
  try {
    for (const [api, email] of [
      [secretaryApi, secretaryEmail],
      [doctorApi, doctorEmail],
    ] as const) {
      const result = await api.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
    }
    for (let i = 0; i < 2; i++) {
      const id = randomUUID();
      const created = await secretaryApi.rpc("clinical_create_patient", {
        p_id: id,
        p_clinic: clinicId,
        p_name: `مريض تنافس ${i}`,
        p_phone: "+12025550125",
        p_height: 170,
        p_gender: "female",
        p_birth_year: 1990,
        p_goal: "نقص وزن",
      });
      if (created.error) throw created.error;
      const queued = await secretaryApi.rpc("clinical_enqueue", {
        p_clinic: clinicId,
        p_patient: id,
        p_kind: "full_exam",
      });
      if (queued.error) throw queued.error;
      const measured = await secretaryApi.rpc("clinical_save_measurements", {
        p_queue: queued.data.id,
        p_revision: queued.data.revision,
        p_values: {
          weight: 80,
          fat: 20,
          muscle: 30,
          visceral: 7,
          bmr: 1600,
          waist: 85,
          arm: 30,
          thigh: 50,
          hip: 100,
        },
      });
      if (measured.error) throw measured.error;
      entries.push(measured.data);
    }
    const pages = await Promise.all(
      contexts.map((context) => context.newPage())
    );
    for (const page of pages.slice(0, 2))
      await login(page, secretaryEmail, "secretary");
    await login(pages[2], doctorEmail, "doctor");
    for (const [index, page] of pages.slice(0, 2).entries())
      await expect(
        page
          .locator(".queue-card")
          .filter({ hasText: `مريض تنافس ${index}` })
          .getByRole("button", { name: "إدخال عند الطبيب" })
      ).toBeEnabled();
    // Hold both handoff POSTs until both UIs have submitted their independently
    // loaded snapshots. Polling cannot turn this into a sequential-button test.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let arrivals = 0;
    for (const page of pages.slice(0, 2))
      await page.route("**/secretary", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        if (++arrivals === 2) release();
        await gate;
        await route.continue();
      });
    await Promise.all(
      pages.slice(0, 2).map((page, i) =>
        page
          .locator(".queue-card")
          .filter({ hasText: `مريض تنافس ${i}` })
          .getByRole("button", { name: "إدخال عند الطبيب" })
          .click()
      )
    );
    await expect
      .poll(
        async () =>
          (
            await secretaryApi
              .from("daily_queue")
              .select("id")
              .eq("clinic_id", clinicId)
              .eq("status", "with_doctor")
          ).data?.length
      )
      .toBe(1);
    const active = await secretaryApi
      .from("daily_queue")
      .select("id,revision")
      .eq("clinic_id", clinicId)
      .eq("status", "with_doctor")
      .single();
    if (active.error) throw active.error;
    const loserIndex = entries.findIndex(
      (entry) => entry.id !== active.data.id
    );
    const loserPage = pages[loserIndex];
    await expect(loserPage.locator("p[role=alert]")).toContainText(
      "يوجد مريض عند الطبيب حالياً"
    );
    await expect(
      loserPage
        .locator(".queue-card")
        .filter({ hasText: `مريض تنافس ${loserIndex}` })
        .getByRole("button", { name: "إدخال عند الطبيب" })
    ).toBeEnabled();
    await pages[2].evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(pages[2].locator(".doctor-current")).toBeVisible();
    const finished = await doctorApi.rpc("clinical_finish", {
      p_queue: active.data.id,
      p_revision: active.data.revision,
      p_request: randomUUID(),
      p_notes: "Synthetic",
      p_days: plan,
      p_appointment: null,
    });
    if (finished.error) throw finished.error;
    await loserPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    const retry = loserPage
      .locator(".queue-card")
      .filter({ hasText: `مريض تنافس ${loserIndex}` })
      .getByRole("button", { name: "إدخال عند الطبيب" });
    await expect(retry).toBeEnabled();
    await retry.click();
    await expect(loserPage).toHaveURL(/sent=1/);
    await pages[2].evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(pages[2].locator(".doctor-current")).toContainText(
      `مريض تنافس ${loserIndex}`
    );
  } finally {
    for (const entry of entries) {
      const result = await doctorApi
        .from("daily_queue")
        .select("revision,status")
        .eq("id", entry.id)
        .single();
      if (result.data?.status === "with_doctor") {
        const finished = await doctorApi.rpc("clinical_finish", {
          p_queue: entry.id,
          p_revision: result.data.revision,
          p_request: randomUUID(),
          p_notes: "Synthetic cleanup",
          p_days: plan,
          p_appointment: null,
        });
        if (finished.error) throw finished.error;
      }
    }
    for (const context of contexts) await context.close();
    await secretaryApi.auth.signOut();
    await doctorApi.auth.signOut();
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
    // Intake uses the secretary's persisted Slice 1 authorization contract.
    email: secretaryEmail,
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
    p_kind: "full_exam",
  });
  queue = await rpc("clinical_save_measurements", {
    p_queue: queue.id,
    p_revision: queue.revision,
    p_values: {
      weight: 80,
      fat: 20,
      muscle: 30,
      visceral: 7,
      bmr: 1600,
      waist: 85,
      arm: 30,
      thigh: 50,
      hip: 100,
    },
  });
  queue = await rpc("clinical_handoff", {
    p_queue: queue.id,
    p_revision: queue.revision,
    p_request: randomUUID(),
  });
  // Subsequent API completion must be a doctor operation, like both browser
  // sessions below. Do not reuse the secretary's intake session for finish.
  const doctorSession = await api.auth.signInWithPassword({
    email: doctorEmail,
    password,
  });
  if (doctorSession.error) throw doctorSession.error;
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
