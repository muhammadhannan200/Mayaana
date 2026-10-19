import { expect, test } from "@playwright/test";

for (const route of [
  "/secretary",
  "/secretary/search",
  "/secretary/patients",
  "/secretary/patients/new",
  "/secretary/account",
]) {
  test(`signed-out visitor cannot open ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
  });
}
