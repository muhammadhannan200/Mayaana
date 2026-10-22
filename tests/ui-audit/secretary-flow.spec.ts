import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function checkSurface(page: Page) {
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

test("existing patient: empty queue → search → confirm → S5/S5b → handoff → doctor, including reload and tab sync", async ({
  page,
  context,
}, info) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  const writes: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (["POST", "PATCH", "DELETE", "PUT"].includes(r.method()))
      writes.push(r.url());
  });
  await page.goto("/demo/secretary");
  await expect(
    page.getByRole("heading", { name: "الدور فارغ الآن" })
  ).toBeVisible();
  await checkSurface(page);
  await page.getByRole("link", { name: "إضافة مريض للدور" }).click();
  await page.getByLabel("اسم المريض أو رقم هاتفه").fill("ريم");
  await page.getByRole("link", { name: /ريم الخطيب/ }).click();
  await page.getByRole("radio", { name: /مراجعة/ }).check();
  await checkSurface(page);
  await page
    .getByRole("button", { name: "إضافة للدور", exact: true })
    .dblclick();
  await expect(page.locator(".queue-list:visible > li")).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("s1.png"), fullPage: true });
  await page.getByRole("link", { name: "أخذ القياس" }).click();
  const weight = page.getByLabel("الوزن اليوم");
  await expect(weight).toHaveValue("");
  await page.getByRole("button", { name: /حفظ القياسات/ }).click();
  await expect(weight).toHaveAttribute("aria-invalid", "true");
  await weight.fill("٦٤٫٥");
  await page.getByRole("link", { name: /عرض تفاصيل الزيارات/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "تعديل القياسات" }).click();
  await dialog
    .getByRole("textbox", { name: "الوزن", exact: true })
    .fill("٦٨٫٢");
  await dialog.getByRole("button", { name: "حفظ التعديل محلياً" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("الوزن اليوم")).toHaveValue("٦٤٫٥");
  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("الوزن اليوم")).toHaveValue("٦٤٫٥");
  await page.getByRole("button", { name: /حفظ القياسات/ }).click();
  const doctor = await context.newPage();
  await doctor.goto("/demo/doctor");
  await expect(
    doctor.locator(".doctor-queue").filter({ hasText: "الدور برّا" })
  ).toContainText("ريم الخطيب");
  await page.getByRole("button", { name: "إدخال عند الطبيب" }).click();
  await expect(page.locator(".doctor-card")).toContainText("ريم الخطيب");
  await expect(doctor.locator(".doctor-current")).toContainText("ريم الخطيب");
  await doctor.getByRole("link", { name: "فتح الملف", exact: true }).click();
  await expect(doctor.locator(".demo-measurements")).toContainText("64.5");
  await expect(doctor.getByText(/68.2/)).toBeVisible();
  await doctor.reload();
  await expect(doctor.locator(".demo-measurements")).toContainText("64.5");
  await checkSurface(doctor);
  await page.goto("/demo/secretary/confirm?patient=demo-reem");
  await expect(
    page.getByText("المريض موجود في دور اليوم بالفعل.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "إضافة للدور", exact: true })
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test("new patient: E2 → S4 → S3 → S6 validates all fields and shares identity with doctor", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await page.goto("/demo/secretary/search");
  await page.getByLabel("اسم المريض أو رقم هاتفه").fill("غير موجود");
  await expect(
    page.getByRole("heading", { name: "لا توجد نتائج" })
  ).toBeVisible();
  await checkSurface(page);
  await page.getByRole("link", { name: "فتح ملف مريض جديد" }).click();
  await page.getByLabel("الاسم الكامل").fill("هبة أحمد");
  await page.getByLabel("رقم الهاتف").fill("٠٩٥١٢٣٤٥٦٧");
  await page.getByLabel("الطول").fill("١٦٥");
  await page.getByLabel("سنة الميلاد").fill("١٩٩٠");
  await checkSurface(page);
  await page.screenshot({ path: info.outputPath("s4.png"), fullPage: true });
  await page.getByRole("button", { name: /حفظ ومتابعة/ }).click();
  await expect(page.getByRole("heading", { name: "هبة أحمد" })).toBeVisible();
  await page.getByRole("button", { name: "إضافة للدور", exact: true }).click();
  await page.getByRole("link", { name: "أخذ القياس" }).click();
  await expect(
    page.getByRole("heading", { name: "قياس كامل", exact: true })
  ).toBeVisible();
  await expect(page.getByText(/هبة أحمد · كشفية/)).toBeVisible();
  await page.getByRole("button", { name: /حفظ القياسات/ }).click();
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(9);
  const values: Record<string, string> = {
    الوزن: "82.7",
    "نسبة الدهون": "30",
    "الكتلة العضلية": "34.6",
    "الدهون الحشوية": "12",
    "الحرق الأساسي": "1822",
    الخصر: "89",
    الذراع: "31",
    الفخذ: "49",
    الورك: "103",
  };
  for (const [label, value] of Object.entries(values))
    await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  await page.getByRole("link", { name: "إغلاق شاشة القياس" }).click();
  await page.getByRole("link", { name: "أخذ القياس" }).click();
  await expect(
    page.getByRole("textbox", { name: "الوزن", exact: true })
  ).toHaveValue("82.7");
  await checkSurface(page);
  await page.getByRole("button", { name: /حفظ القياسات/ }).click();
  await page.getByRole("button", { name: "إدخال عند الطبيب" }).click();
  await page.getByRole("link", { name: "عرض الطبيب" }).click();
  await expect(page.locator(".doctor-current")).toContainText("هبة أحمد");
  await page.getByRole("link", { name: "فتح الملف", exact: true }).click();
  await expect(page.locator(".demo-measurements > div")).toHaveCount(9);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("هبة أحمد");
});

test("recovery, cancel, unknown demo route and staff guards remain functional", async ({
  page,
}) => {
  await page.goto("/demo/secretary/measurements/follow-up?entry=missing");
  await page.getByRole("link", { name: "العودة للدور" }).click();
  await page.goto("/demo/secretary/patients/new");
  await page.getByRole("link", { name: "إلغاء", exact: true }).press("Enter");
  await expect(page).toHaveURL(/demo\/secretary\/search/);
  const response = await page.goto("/demo/unknown");
  expect(response?.status()).toBe(404);
  for (const path of [
    "/secretary",
    "/secretary/search",
    "/secretary/confirm",
    "/secretary/patients/new",
    "/doctor",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
  }
});
