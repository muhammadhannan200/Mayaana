import { expect, test } from "@playwright/test";

test("secretary patient file shows visits read-only and saves edits", async ({
  page,
}) => {
  await page.goto("/demo/secretary/patients");
  await page.getByRole("link", { name: /سامر درويش/ }).click();
  await expect(page).toHaveURL(/\/demo\/secretary\/patients\/demo-samer$/);
  await expect(
    page.getByRole("heading", { name: "الأوزان المسجّلة" })
  ).toBeVisible();

  await page.getByRole("button", { name: "عرض قياسات الزيارة 1" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("88.6")).toBeVisible();
  await expect(sheet.getByRole("button", { name: /تعديل/ })).toHaveCount(0);
  await sheet.getByRole("button", { name: "إغلاق" }).first().click();

  await page.getByRole("link", { name: "تعديل البيانات" }).click();
  await page.getByLabel("الطول").fill("٢٠");
  await page.getByRole("button", { name: "حفظ التعديلات" }).click();
  await expect(page.locator(".secretary-error")).toContainText("تحقق من الاسم");
  await page.getByLabel("الطول").fill("١٨٠");
  await page.getByRole("button", { name: "حفظ التعديلات" }).click();
  await expect(page).toHaveURL(/\/demo\/secretary\/patients\/demo-samer$/);
  await expect(page.getByText("180 سم")).toBeVisible();

  await page.getByRole("link", { name: "إضافة للدور" }).click();
  await expect(page).toHaveURL(/secretary\/confirm\?patient=demo-samer$/);
});
