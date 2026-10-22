import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function checkSurface(page: Page) {
  await expect(page).toHaveTitle(/\S/);
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

test("complete V1: secretary intake → measurements → handoff → doctor notes → diet and meal → completed visit", async ({
  page,
  context,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  const writes: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (r) => {
    if (["POST", "PATCH", "DELETE", "PUT"].includes(r.method()))
      writes.push(r.url());
  });
  await page.goto("/demo/secretary");
  await expect(page.locator(".queue-totals")).toHaveText(
    /3بالانتظار1عند الطبيب1انتهت/
  );
  await expect(
    page.getByText("القياسات غير مكتملة", { exact: false })
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("populated-queue.png"),
    fullPage: true,
  });
  await checkSurface(page);
  await page.getByRole("link", { name: "إضافة للدور", exact: true }).click();
  await page.getByLabel("اسم المريض أو رقم هاتفه").fill("ريم");
  await page.getByRole("link", { name: /ريم الخطيب/ }).click();
  await page.getByRole("radio", { name: /مراجعة/ }).check();
  await checkSurface(page);
  await page
    .getByRole("button", { name: "إضافة للدور", exact: true })
    .dblclick();
  await expect(
    page.locator(".queue-card").filter({ hasText: "ريم الخطيب" })
  ).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("s1.png"), fullPage: true });
  await page
    .locator(".queue-card")
    .filter({ hasText: "ريم الخطيب" })
    .getByRole("link", { name: "أخذ القياس" })
    .click();
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
  doctor.on("pageerror", (e) => errors.push(e.message));
  doctor.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await doctor.goto("/demo/doctor");
  await doctor.getByRole("link", { name: "فتح الملف", exact: true }).click();
  await checkSurface(doctor);
  await doctor.screenshot({
    path: info.outputPath("populated-patient-file.png"),
    fullPage: true,
  });
  await doctor.getByRole("link", { name: "زيارة اليوم", exact: true }).click();
  await expect(doctor.getByLabel("ملاحظاتي")).toHaveValue(/نزول تدريجي جيد/);
  await doctor.getByRole("link", { name: "متابعة للبرنامج والموعد" }).click();
  await expect(doctor.locator(".visit-meal")).toHaveCount(5);
  await expect(doctor.getByLabel("تاريخ الموعد")).not.toHaveValue("");
  await doctor.screenshot({
    path: info.outputPath("featured-plan.png"),
    fullPage: true,
  });
  await doctor.reload();
  await expect(doctor.locator(".visit-meal")).toHaveCount(5);
  await doctor.goto("/demo/doctor/patients");
  await checkSurface(doctor);
  await doctor.screenshot({
    path: info.outputPath("populated-patient-list.png"),
    fullPage: true,
  });
  await doctor.getByLabel("اسم المريض أو رقم هاتفه").fill("مريم");
  await doctor.getByRole("link", { name: /مريم العلي/ }).click();
  await doctor.getByRole("link", { name: "عرض الزيارة المكتملة" }).click();
  await expect(doctor.getByRole("status")).toContainText("اكتملت الزيارة");
  await expect(doctor.locator(".visit-meal")).toHaveCount(5);
  await doctor.goto("/demo/doctor");
  await expect(
    doctor.locator(".doctor-queue").filter({ hasText: "الدور برّا" })
  ).toContainText("ريم الخطيب");
  await page
    .locator(".queue-card")
    .filter({ hasText: "ريم الخطيب" })
    .getByRole("button", { name: "إدخال عند الطبيب" })
    .click();
  await expect(
    page.locator(".doctor-card").filter({ hasText: "ريم الخطيب" })
  ).toBeVisible();
  await expect(
    doctor.locator(".doctor-queue").filter({ hasText: "عند الطبيب" })
  ).toContainText("ريم الخطيب");
  await doctor.getByRole("link", { name: /ريم الخطيب/ }).click();
  await expect(doctor.locator(".demo-measurements")).toContainText("64.5");
  await expect(doctor.locator(".demo-visit-history")).toContainText("68.2");
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
  await doctor.getByRole("link", { name: "زيارة اليوم", exact: true }).click();
  await expect(
    doctor.getByRole("heading", { name: "زيارة اليوم" })
  ).toBeVisible();
  await expect(doctor.locator(".visit-weight")).toContainText("64.5");
  await doctor.getByLabel("ملاحظاتي").fill("تقليل السكريات والمشي يومياً");
  await doctor.reload();
  await expect(doctor.getByLabel("ملاحظاتي")).toHaveValue(
    "تقليل السكريات والمشي يومياً"
  );
  await checkSurface(doctor);
  await doctor.screenshot({ path: info.outputPath("d8.png"), fullPage: true });
  await doctor.getByRole("link", { name: "متابعة للبرنامج والموعد" }).click();
  await doctor.getByRole("button", { name: "إضافة يوم", exact: true }).click();
  await doctor.getByRole("button", { name: "إضافة وجبة", exact: true }).click();
  await doctor.getByRole("radio", { name: "فطور", exact: true }).check();
  await doctor
    .getByLabel("تفاصيل الوجبة")
    .fill("بيضتان مسلوقتان + خبز أسمر + خيار");
  await doctor.screenshot({ path: info.outputPath("d9b.png"), fullPage: true });
  await checkSurface(doctor);
  await doctor
    .getByRole("button", { name: "إضافة الوجبة", exact: true })
    .click();
  await doctor.getByRole("button", { name: "تعديل فطور", exact: true }).click();
  await doctor
    .getByLabel("تفاصيل الوجبة")
    .fill("بيضتان مسلوقتان + خبز أسمر + خضار");
  await doctor.getByRole("button", { name: "حفظ الوجبة", exact: true }).click();
  const appointment = "2030-11-15";
  await doctor.getByLabel("تاريخ الموعد").fill(appointment);
  await doctor.reload();
  await expect(doctor.getByLabel("تاريخ الموعد")).toHaveValue(appointment);
  await expect(doctor.locator(".visit-meal")).toContainText("خضار");
  await doctor.getByRole("button", { name: "إضافة يوم", exact: true }).click();
  doctor.once("dialog", (dialog) => dialog.dismiss());
  await doctor.getByRole("button", { name: "حذف اليوم 2" }).click();
  await expect(doctor.locator(".visit-day")).toHaveCount(2);
  doctor.once("dialog", (dialog) => dialog.accept());
  await doctor.getByRole("button", { name: "حذف اليوم 2" }).click();
  await expect(doctor.locator(".visit-day")).toHaveCount(1);
  await expect(doctor.locator(".visit-meal")).toContainText("خضار");
  await checkSurface(doctor);
  await doctor.screenshot({ path: info.outputPath("d9.png"), fullPage: true });
  await doctor
    .getByRole("button", { name: "إنهاء الزيارة", exact: true })
    .click();
  await expect(doctor.getByRole("dialog")).toContainText("ريم الخطيب");
  await doctor.screenshot({ path: info.outputPath("d10.png"), fullPage: true });
  await checkSurface(doctor);
  await doctor
    .getByRole("button", { name: "حفظ وإنهاء الزيارة", exact: true })
    .click();
  await expect(doctor.getByRole("status")).toContainText("اكتملت الزيارة");
  await doctor.reload();
  await expect(doctor.getByRole("status")).toContainText("اكتملت الزيارة");
  await checkSurface(doctor);
  await expect(doctor.getByLabel("ملاحظاتي")).toHaveValue(
    "تقليل السكريات والمشي يومياً"
  );
  await expect(doctor.locator(".visit-meal")).toContainText("خضار");
  await expect(doctor.locator(".visit-appointment")).toContainText(appointment);
  await expect(
    doctor.getByRole("button", { name: "إنهاء الزيارة", exact: true })
  ).toHaveCount(0);
  await page.getByRole("link", { name: "العودة للدور", exact: true }).click();
  await expect(
    page.locator(".queue-card").filter({ hasText: "ريم الخطيب" })
  ).toContainText("اكتملت الزيارة");
  await expect(
    page.getByRole("heading", { name: "عند الطبيب (0)" })
  ).toHaveCount(0);
  await doctor
    .getByRole("link", { name: "العودة للرئيسية", exact: true })
    .click();
  await expect(doctor.locator(".doctor-current")).toContainText("نور الحسن");
  await expect(
    doctor.getByRole("heading", { name: "الزيارات المكتملة (2)" })
  ).toBeVisible();
  await page.goto("/demo/secretary/account");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "إعادة ضبط العرض التجريبي" }).click();
  await expect(page.locator(".queue-totals")).toHaveText(
    /3بالانتظار1عند الطبيب1انتهت/
  );
  await expect(
    doctor.getByRole("heading", { name: "الزيارات المكتملة (1)" })
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".queue-totals")).toHaveText(
    /3بالانتظار1عند الطبيب1انتهت/
  );
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
  await page
    .locator(".queue-card")
    .filter({ hasText: "هبة أحمد" })
    .getByRole("link", { name: "أخذ القياس" })
    .click();
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
  await page
    .locator(".queue-card")
    .filter({ hasText: "هبة أحمد" })
    .getByRole("link", { name: "أخذ القياس" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "الوزن", exact: true })
  ).toHaveValue("82.7");
  await checkSurface(page);
  await page.getByRole("button", { name: /حفظ القياسات/ }).click();
  await page
    .locator(".queue-card")
    .filter({ hasText: "هبة أحمد" })
    .getByRole("button", { name: "إدخال عند الطبيب" })
    .click();
  await page.getByRole("link", { name: "عرض الطبيب" }).click();
  await expect(
    page.locator(".doctor-queue").filter({ hasText: "عند الطبيب" })
  ).toContainText("هبة أحمد");
  await page.getByRole("link", { name: /هبة أحمد/ }).click();
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
  // Next streams the demo shell in production: notFound can keep HTTP 200.
  expect([200, 404]).toContain(response?.status());
  await expect(
    page.getByRole("heading", { name: "404", exact: true })
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    "content",
    /noindex/
  );
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
