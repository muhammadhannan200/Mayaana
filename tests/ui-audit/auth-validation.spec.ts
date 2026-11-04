import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function submit(page: Page) {
  // Blank-backend audit intentionally keeps Login disabled. Exercise validation
  // through native submission, never a hosted backend or test credential.
  await page
    .locator("form.auth-form")
    .evaluate((form: HTMLFormElement) => form.requestSubmit());
}

test("Login required errors: stable descriptions, first-invalid focus and repeated submission", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const email = page.getByLabel("البريد الإلكتروني", { exact: true });
  const password = page.getByLabel("كلمة المرور", { exact: true });
  await expect(email).toHaveAttribute("aria-invalid", "false");
  await submit(page);
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", "email-error");
  await expect(email).toHaveAccessibleDescription("أدخل البريد الإلكتروني.");
  await expect(password).toHaveAccessibleDescription("أدخل كلمة المرور.");
  await expect(page.locator("form.auth-form [role=alert]")).toHaveCount(1);
  await expect(
    page.locator("#email-error[role], #password-error[role]")
  ).toHaveCount(0);
  await password.focus();
  await submit(page);
  await expect(email).toBeFocused();
  await expect(page.locator("#email-error")).toHaveCount(1);
  await expect(page.locator("#password-error")).toHaveCount(1);
  await expect(page.locator("form.auth-form [role=alert]")).toHaveCount(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if ([320, 1280].includes(page.viewportSize()!.width))
    await page.screenshot({
      path: testInfo.outputPath("login-required-errors.png"),
      fullPage: true,
    });
});

test("Login validation remains server-authoritative without JavaScript", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: testInfo.project.use.viewport,
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    // Native submission bypasses both hydration and browser constraint bubbles.
    await submit(page);
    await expect(page.locator("#email-error")).toHaveText(
      "أدخل البريد الإلكتروني."
    );
    await expect(page.locator("#password-error")).toHaveText(
      "أدخل كلمة المرور."
    );
    await expect(
      page.getByLabel("البريد الإلكتروني", { exact: true })
    ).toHaveAttribute("aria-invalid", "true");
  } finally {
    await context.close();
  }
});

test("Login format correction preserves values, visibility, selection and RTL", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const email = page.getByLabel("البريد الإلكتروني", { exact: true });
  const password = page.getByLabel("كلمة المرور", { exact: true });
  await email.fill("invalid");
  await password.fill("Synthetic-visibility-50!");
  await page
    .getByRole("button", { name: "إظهار كلمة المرور", exact: true })
    .click();
  await submit(page);
  await expect(email).toBeFocused();
  await expect(email).toHaveAccessibleDescription(/بريداً إلكترونياً صالحاً/);
  await expect(password).toHaveAttribute("aria-invalid", "false");
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("Synthetic-visibility-50!");
  await email.fill("USER@Example.test");
  await expect(email).toHaveAttribute("aria-invalid", "false");
  await expect(email).not.toHaveAttribute("aria-describedby");
  await password.focus();
  await password.evaluate((input: HTMLInputElement) =>
    input.setSelectionRange(2, 8, "backward")
  );
  // A valid correction reaches only the blank-config service guard.
  await submit(page);
  await expect(page.locator("form.auth-form [role=alert]")).toHaveText(
    "خدمة الدخول غير متاحة حالياً. حاول لاحقاً."
  );
  await expect(password).toBeFocused();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  expect(
    await password.evaluate((input: HTMLInputElement) => [
      input.selectionStart,
      input.selectionEnd,
      input.selectionDirection,
    ])
  ).toEqual([2, 8, "backward"]);
  await expect(email).toHaveValue("USER@Example.test");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if ([320, 1280].includes(page.viewportSize()!.width))
    await page.screenshot({
      path: testInfo.outputPath("login-validation.png"),
      fullPage: true,
    });
});
