import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const failures = {
  credentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  service: "تعذّر الاتصال بالخدمة. حاول مرة أخرى.",
} as const;
type Failure = keyof typeof failures;
const unavailable = "خدمة الدخول غير متاحة حالياً. حاول لاحقاً.";

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function interceptFailures(page: Page, kinds: Failure[]) {
  const requests = kinds.map(() => ({ received: gate(), release: gate() }));
  let index = 0;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || !request.headers()["next-action"])
      return route.continue();
    const current = index++;
    expect(current).toBeLessThan(kinds.length);
    // Fetch only the loopback app's blank-backend guard. Rewrite its existing
    // serialized action result in test transport, not application/Auth code.
    const response = await route.fetch();
    const body = await response.text();
    expect(response.ok()).toBe(true);
    expect(body).toContain(unavailable);
    expect(body).toContain('"kind":"service"');
    requests[current].received.resolve();
    await requests[current].release.promise;
    await route.fulfill({
      response,
      body: body
        .replace(unavailable, failures[kinds[current]])
        .replace('"kind":"service"', `"kind":"${kinds[current]}"`),
    });
  });
  return requests;
}

async function submit(page: Page) {
  // Preserve the disabled unavailable-state button; no real backend is configured.
  await page
    .locator("form.auth-form")
    .evaluate((form: HTMLFormElement) => form.requestSubmit());
}

for (const kind of ["credentials", "service"] as const) {
  test(`${kind}: edits during pending cannot dismiss a new response, including repeated errors`, async ({
    page,
  }) => {
    const other = kind === "credentials" ? "service" : "credentials";
    const kinds: Failure[] = [kind, other, other];
    const requests = await interceptFailures(page, kinds);
    try {
      await page.goto("/");
      const email = page.getByLabel("البريد الإلكتروني", { exact: true });
      const password = page.getByLabel("كلمة المرور", { exact: true });
      const alert = page.locator("form.auth-form [role=alert]");
      await email.fill("synthetic@example.test");
      await password.fill("Synthetic-pending-50!");
      await page
        .getByRole("button", { name: "إظهار كلمة المرور", exact: true })
        .click();
      for (const [index, request] of requests.entries()) {
        await submit(page);
        await request.received.promise;
        await expect(
          page.getByRole("button", { name: "جارٍ الدخول…" })
        ).toBeDisabled();
        await expect(alert).toHaveCount(0);
        await email.fill(`synthetic-${index}@example.test`);
        await password.fill(`Synthetic-pending-${index}!`);
        await password.evaluate((input: HTMLInputElement) =>
          input.setSelectionRange(2, 8, "backward")
        );
        await expect(alert).toHaveCount(0);
        request.release.resolve();
        await expect(alert).toHaveText(failures[kinds[index]]);
        await expect(alert).toHaveCount(1);
        await expect(password).toBeFocused();
        await expect(password).toHaveAttribute("type", "text");
        await expect(password).toHaveValue(`Synthetic-pending-${index}!`);
        await expect(password).toHaveAttribute(
          "autocomplete",
          "current-password"
        );
        await expect(email).toHaveAttribute("aria-invalid", "false");
        await expect(password).toHaveAttribute("aria-invalid", "false");
        expect(
          await password.evaluate((input: HTMLInputElement) => [
            input.selectionStart,
            input.selectionEnd,
            input.selectionDirection,
          ])
        ).toEqual([2, 8, "backward"]);
        // Once this response has arrived, correction may dismiss it normally.
        await email.fill(`corrected-${index}@example.test`);
        await expect(alert).not.toHaveText(failures[kinds[index]]);
      }
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth)
      ).toBeLessThanOrEqual(page.viewportSize()!.width);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    } finally {
      for (const request of requests) request.release.resolve();
    }
  });
}

test("a superseded response stays hidden until the queued submission completes", async ({
  page,
}) => {
  const requests = await interceptFailures(page, ["credentials", "service"]);
  try {
    await page.goto("/");
    const email = page.getByLabel("البريد الإلكتروني", { exact: true });
    await email.fill("synthetic@example.test");
    await page
      .getByLabel("كلمة المرور", { exact: true })
      .fill("Synthetic-pending-50!");
    await submit(page);
    await requests[0].received.promise;
    await email.fill("superseding@example.test");
    // Stress React's sequential action queue without enabling the disabled button.
    await submit(page);
    requests[0].release.resolve();
    await requests[1].received.promise;
    await expect(page.locator("form.auth-form [role=alert]")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "جارٍ الدخول…" })
    ).toBeDisabled();
    await email.fill("latest@example.test");
    requests[1].release.resolve();
    await expect(page.locator("form.auth-form [role=alert]")).toHaveText(
      failures.service
    );
    await expect(
      page.getByText(failures.credentials, { exact: true })
    ).toHaveCount(0);
    await expect(email).toHaveValue("latest@example.test");
  } finally {
    for (const request of requests) request.release.resolve();
  }
});
