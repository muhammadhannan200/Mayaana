import { expect, test } from "@playwright/test";

const busy = "الطبيب مع نور الحسن حالياً";
const available = "الطبيب متاح الآن لاستقبال المريض التالي.";
const send = "إدخال عند الطبيب";

async function finishFeaturedVisit(page: import("@playwright/test").Page) {
  await page.goto("/demo/doctor/visits/demo-featured?step=plan");
  const save = page.getByRole("button", {
    name: "حفظ وإنهاء الزيارة",
    exact: true,
  });
  // The first click can land before hydration on a slow server.
  await expect(async () => {
    await page
      .getByRole("button", { name: "إنهاء الزيارة", exact: true })
      .click();
    await expect(save).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30000 });
  await save.click();
  await expect(page.getByRole("status").first()).toContainText("اكتملت الزيارة");
}

test("doctor busy: secretary is told who is inside and nobody else enters", async ({
  page,
}) => {
  await page.goto("/demo/secretary");
  await expect(page.getByText(busy).first()).toBeVisible();
  const button = page.getByRole("button", { name: send }).first();
  await button.click();
  await expect(page.locator(".secretary-error")).toContainText(busy);
  await expect(page.getByRole("heading", { name: "عند الطبيب (1)" })).toBeVisible();
});

test("doctor home shows only the single green card", async ({ page }) => {
  await page.goto("/demo/doctor");
  await expect(page.locator(".doctor-current")).toContainText("نور الحسن");
  await expect(page.getByRole("heading", { name: /عند الطبيب \(/ })).toHaveCount(0);
});

test("after the doctor finishes: available notice, handoff, cancel within a minute", async ({
  page,
}) => {
  await finishFeaturedVisit(page);
  await page.goto("/demo/secretary");
  await expect(page.getByText(available)).toBeVisible();
  await page.getByRole("button", { name: send }).first().click();
  await expect(page).toHaveURL(/sent=1/);
  const cancel = page.getByRole("button", { name: /إلغاء الإدخال/ });
  await cancel.click();
  await expect(page.getByRole("heading", { name: /عند الطبيب \(/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: send }).first()).toBeVisible();
});

test("cancel disappears once the doctor opens the visit", async ({ page }) => {
  await finishFeaturedVisit(page);
  await page.goto("/demo/secretary");
  await page.getByRole("button", { name: send }).first().click();
  await expect(page.getByRole("button", { name: /إلغاء الإدخال/ })).toBeVisible();
  await page.goto("/demo/doctor");
  await page.getByRole("link", { name: "فتح الملف" }).click();
  await page.getByRole("link", { name: /فتح الزيارة|زيارة اليوم/ }).first().click();
  await expect(page).toHaveURL(/doctor\/visits\//);
  await page.goto("/demo/secretary");
  await expect(page.getByRole("button", { name: /إلغاء الإدخال/ })).toHaveCount(0);
});
