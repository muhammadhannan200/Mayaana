import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const mode of ["follow-up", "previous", "full-exam"]) {
  test(`${mode} matches the RTL measurement surface without overflow or axe violations`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/measurement-preview/${mode}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      mode === "full-exam" ? "قياس كامل" : "قياس الوزن"
    );
    const geometry = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const visible = [
        ...document.querySelectorAll(
          ".measure-shell input, .measure-shell button, dialog[open] input, dialog[open] button"
        ),
      ];
      return {
        viewport,
        width: document.documentElement.scrollWidth,
        outside: visible
          .filter((element) => {
            const bounds = element.getBoundingClientRect();
            return (
              bounds.width && (bounds.left < -1 || bounds.right > viewport + 1)
            );
          })
          .map((element) => element.outerHTML),
      };
    });
    expect(geometry.width).toBeLessThanOrEqual(geometry.viewport + 1);
    expect(geometry.outside).toEqual([]);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2)
    ).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`${mode}.png`),
      fullPage: true,
    });
  });
}

test("follow-up validates localized decimals without sending any patient data", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
      writes.push(request.url());
  });
  await page.goto("/measurement-preview/follow-up");
  const weight = page.getByLabel("الوزن اليوم");
  const verify = page.getByRole("button", {
    name: "تحقّق من القياسات فقط",
  });
  for (const value of ["", "0", "-1", "501", "65.123", "abc"]) {
    await weight.fill(value);
    await verify.click();
    await expect(weight).toHaveAttribute("aria-invalid", "true");
    await expect(weight).toBeFocused();
    await expect(page.getByRole("status")).toHaveCount(0);
  }
  for (const value of ["٦٥٫٥", "۶۵٫۵", "65,5"]) {
    await weight.fill(value);
    await verify.click();
    await expect(page.getByRole("status")).toContainText("لم تُرسل للطبيب");
    await expect(weight).toHaveAttribute("aria-invalid", "false");
  }
  expect(writes).toEqual([]);
  await page.getByRole("link", { name: /عرض تفاصيل الزيارات/ }).click();
  await expect(page).toHaveURL(/measurement-preview\/previous$/);
});

test("previous sheet traps focus, cancels drafts, edits locally and restores the trigger", async ({
  page,
}) => {
  await page.goto("/measurement-preview/previous");
  let dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const visit = page.getByRole("button", {
    name: "عرض قياسات الزيارة 1",
    exact: true,
  });
  await visit.click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("26.5");
  await dialog.getByRole("button", { name: "تعديل القياسات" }).click();
  await expect(dialog.getByLabel("BMI")).toHaveCount(0);
  const weight = dialog.getByRole("textbox", { name: "الوزن", exact: true });
  await weight.fill("٦٨٫٢");
  await dialog.getByRole("button", { name: "إلغاء", exact: true }).click();
  await expect(dialog).toContainText("67.9");
  await dialog.getByRole("button", { name: "تعديل القياسات" }).click();
  await weight.fill("٦٨٫٢");
  await dialog.getByRole("button", { name: "حفظ التعديل محلياً" }).click();
  await expect(dialog).toContainText("68.2");
  const close = dialog.getByRole("button", { name: "إغلاق", exact: true });
  await close.focus();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest("dialog"))
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(visit).toBeFocused();
  await expect(visit).toContainText("68.2");
  await page.getByLabel("الوزن اليوم").fill("٧٠");
  await expect(page.locator(".measure-weight-change")).toContainText(
    "بعيد عن الهدف"
  );
  await page.getByLabel("الوزن اليوم").fill("invalid");
  await expect(page.locator(".measure-weight-change")).toHaveCount(0);
  await expect(page.locator(".measure-content")).not.toContainText("NaN");
});

test("full exam validates every field and can be verified locally", async ({
  page,
}) => {
  await page.goto("/measurement-preview/full-exam");
  await expect(page.getByRole("textbox")).toHaveCount(9);
  const fat = page.getByRole("textbox", { name: "نسبة الدهون", exact: true });
  await fat.fill("101");
  await page.getByRole("button", { name: /تحقّق من القياسات/ }).click();
  await expect(fat).toHaveAttribute("aria-invalid", "true");
  await fat.fill("٣٠٫٥");
  await page.getByRole("button", { name: /تحقّق من القياسات/ }).click();
  await expect(page.getByRole("status")).toContainText("لم تُرسل للطبيب");
});

test("preview navigation rejects unknown modes and protects staff routes", async ({
  page,
}) => {
  await page.goto("/measurement-preview");
  await expect(page.getByRole("link")).toHaveCount(4);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/
  );
  const response = await page.goto("/measurement-preview/not-a-screen");
  expect(response?.status()).toBe(404);
  for (const path of [
    "/secretary/measurements/follow-up",
    "/secretary/measurements/previous",
    "/secretary/measurements/full-exam",
    "/doctor",
    "/doctor/patients",
    "/doctor/patients/00000000-0000-0000-0000-000000000000",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
  }
});
