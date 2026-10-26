import { expect, test, type Page } from "@playwright/test";

async function finishSeed(page: Page) {
  await page.goto("/demo/doctor/visits/demo-featured?step=plan");
  await page
    .getByRole("button", { name: "إنهاء الزيارة", exact: true })
    .click();
  await page
    .getByRole("button", { name: "حفظ وإنهاء الزيارة", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("اكتملت الزيارة");
}

test("occupied demo slot disables handoff until Doctor completion, with no backend writes", async ({
  page,
  context,
}) => {
  const writes: string[] = [];
  context.on("request", (request) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method()) ||
      /\/rest\/v1\//.test(request.url())
    )
      writes.push(request.url());
  });
  await page.goto("/demo/secretary");
  const handoff = page.getByRole("button", {
    name: "إدخال عند الطبيب",
    exact: true,
  });
  await expect(handoff).toBeDisabled();
  await expect(
    page.getByText("يوجد مريض عند الطبيب بالفعل.", { exact: false })
  ).toBeVisible();
  const doctor = await context.newPage();
  await finishSeed(doctor);
  await expect(handoff).toBeEnabled();
  await handoff.dblclick();
  await expect(
    page.getByRole("heading", { name: "عند الطبيب (1)", exact: true })
  ).toBeVisible();
  await doctor.goto("/demo/doctor");
  await expect(doctor.locator(".doctor-current")).toContainText("سامر درويش");
  await expect(
    doctor.getByRole("heading", { name: "عند الطبيب (1)", exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "عند الطبيب (1)", exact: true })
  ).toBeVisible();
  expect(writes).toEqual([]);
});

test("simultaneous cross-tab demo handoffs serialize and keep the losing patient ready", async ({
  page,
  context,
}) => {
  await finishSeed(page);
  // Synthetic valid, measured candidates; never clinical or hosted records.
  await page.evaluate(() => {
    const key = "mayanaa-demo-v1:public";
    const state = JSON.parse(localStorage.getItem(key)!);
    const values = state.queue.find(
      (entry: { id: string }) => entry.id === "demo-ready"
    ).measurements;
    state.queue = state.queue.map((entry: { id: string }) =>
      entry.id === "demo-waiting"
        ? { ...entry, status: "ready", measurements: values }
        : entry
    );
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.goto("/demo/secretary");
  const other = await context.newPage();
  await other.goto("/demo/secretary");
  const first = page
    .locator(".queue-card")
    .filter({ hasText: "أحمد الخطيب" })
    .getByRole("button");
  const second = other
    .locator(".queue-card")
    .filter({ hasText: "سامر درويش" })
    .getByRole("button");
  await expect(first).toBeEnabled();
  await expect(second).toBeEnabled();
  // Hold the slot lock until BOTH handlers have submitted a lock request.
  // This deterministically exercises arbitration, not just button disabling.
  await page.evaluate(() => {
    void navigator.locks.request(
      "mayanaa-demo-v1:public",
      () =>
        new Promise<void>((resolve) => {
          (window as Window & { releaseHandoff?: () => void }).releaseHandoff =
            resolve;
        })
    );
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (window as Window & { releaseHandoff?: () => void })
            .releaseHandoff
      )
    )
    .toBe("function");
  await Promise.all([
    first.evaluate((button: HTMLButtonElement) => button.click()),
    second.evaluate((button: HTMLButtonElement) => button.click()),
  ]);
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await navigator.locks.query()).pending?.filter(
            (lock) => lock.name === "mayanaa-demo-v1:public"
          ).length
      )
    )
    .toBe(2);
  await page.evaluate(() =>
    (window as Window & { releaseHandoff?: () => void }).releaseHandoff!()
  );
  for (const tab of [page, other]) {
    await expect(
      tab.getByRole("heading", { name: "عند الطبيب (1)", exact: true })
    ).toBeVisible();
  }
  const queue = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("mayanaa-demo-v1:public")!).queue as {
        id: string;
        status: string;
      }[]
  );
  expect(queue.filter((entry) => entry.status === "with_doctor")).toHaveLength(
    1
  );
  expect(
    queue.filter(
      (entry) =>
        ["demo-waiting", "demo-ready"].includes(entry.id) &&
        entry.status === "ready"
    )
  ).toHaveLength(1);
  await expect
    .poll(async () => {
      const alerts = await Promise.all(
        [page, other].map((tab) =>
          tab
            .locator("p[role=alert]")
            .filter({ hasText: "يوجد مريض عند الطبيب بالفعل" })
            .count()
        )
      );
      return alerts.reduce((sum, count) => sum + count, 0);
    })
    .toBe(1);
});

test("demo handoff does not claim success when localStorage cannot commit", async ({
  page,
}) => {
  await finishSeed(page);
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Synthetic quota failure", "QuotaExceededError");
    };
  });
  await page.goto("/demo/secretary");
  await page
    .getByRole("button", { name: "إدخال عند الطبيب", exact: true })
    .click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "تعذّر حفظ حالة الدور"
  );
  expect(new URL(page.url()).searchParams.has("sent")).toBe(false);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("mayanaa-demo-v1:public")!
        ).queue.filter(
          (entry: { status: string }) => entry.status === "with_doctor"
        ).length
    )
  ).toBe(0);
});

test("demo fails closed if cross-tab locks are unavailable", async ({
  page,
}) => {
  await finishSeed(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "locks", {
      value: undefined,
      configurable: true,
    })
  );
  await page.goto("/demo/secretary");
  await page
    .getByRole("button", { name: "إدخال عند الطبيب", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "يتطلب إدخال المريض" })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("mayanaa-demo-v1:public")!
        ).queue.filter(
          (entry: { status: string }) => entry.status === "with_doctor"
        ).length
    )
  ).toBe(0);
});
