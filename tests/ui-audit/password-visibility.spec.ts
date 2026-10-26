import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  exercisePasswordVisibility,
  expectPasswordToggleLayout,
} from "../password-visibility";

test("login visibility: mouse, selection, keyboard, no accidental submits and RTL", async ({
  page,
}) => {
  await page.goto("/");
  await exercisePasswordVisibility(page, ["كلمة المرور"]);
  await expectPasswordToggleLayout(page);
  await page
    .locator("form.auth-form")
    .evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator("form.auth-form")).toHaveAttribute(
    "data-test-submits",
    "1"
  );
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.reload();
  await expect(page.getByLabel("كلمة المرور", { exact: true })).toHaveAttribute(
    "type",
    "password"
  );
});

test("login visibility is touch operable without changing its value", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: testInfo.project.use.viewport,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    const input = page.getByLabel("كلمة المرور", { exact: true });
    await input.fill("Synthetic-touch-50!");
    await page
      .getByRole("button", { name: "إظهار كلمة المرور", exact: true })
      .tap();
    await expect(input).toHaveAttribute("type", "text");
    await page
      .getByRole("button", { name: "إخفاء كلمة المرور", exact: true })
      .tap();
    await expect(input).toHaveAttribute("type", "password");
    await expect(input).toHaveValue("Synthetic-touch-50!");
  } finally {
    await context.close();
  }
});
