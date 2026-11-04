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

async function expectFailedCompletion(page: Page) {
  const review = page.getByRole("dialog");
  await expect(review.getByRole("alert")).toContainText("تعذّر تأكيد");
  await expect(page.getByText("اكتملت الزيارة", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "زيارة اليوم", exact: true })).toBeVisible();
  await review.getByRole("button", { name: "رجوع", exact: true }).click();
}

async function accountAfterLocalFailure(page: Page) {
  // Explicitly discard this editor's recovery copy, not its shared store.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "العودة لملف المريض", exact: true }).click();
  await page.getByRole("link", { name: "العودة", exact: true }).click();
  await expect(page).toHaveURL("/demo/doctor");
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي", exact: true })
    .getByRole("link", { name: "الحساب", exact: true })
    .click();
  await expect(page).toHaveURL("/demo/secretary/account");
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

for (const recover of [false, true]) {
  test(`simultaneous cross-tab demo handoffs serialize and keep the losing patient ready${recover ? " after storage recovery and reload" : ""}`, async ({
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
    if (recover) {
      await page.evaluate(() => {
        const get = Storage.prototype.getItem;
        Object.assign(window, {
          restoreStorage: () => {
            Storage.prototype.getItem = get;
          },
        });
        Storage.prototype.getItem = () => {
          throw new DOMException("Synthetic read failure", "SecurityError");
        };
      });
      await first.click();
      await expect(page.locator("p[role=alert]")).toContainText(
        "تعذّر حفظ حالة الدور"
      );
      await page.evaluate(() =>
        (window as Window & { restoreStorage?: () => void }).restoreStorage!()
      );
      // A failed store must not resume publishing a disconnected snapshot.
      await first.click();
      await expect(page.locator("p[role=alert]")).toContainText(
        "تعذّر حفظ حالة الدور"
      );
      await page.reload();
      await expect(first).toBeEnabled();
    }
    // Hold the slot lock until BOTH handlers have submitted a lock request.
    // This deterministically exercises arbitration, not just button disabling.
    await page.evaluate(() => {
      void navigator.locks.request(
        "mayanaa-demo-v1:public",
        () =>
          new Promise<void>((resolve) => {
            (
              window as Window & { releaseHandoff?: () => void }
            ).releaseHandoff = resolve;
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
    expect(
      queue.filter((entry) => entry.status === "with_doctor")
    ).toHaveLength(1);
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
}

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

for (const failure of ["read", "draft-write", "queue-write"] as const) {
  test(`recovered ${failure} failure cannot publish stale cross-tab queue state`, async ({
    page,
    context,
  }) => {
    await page.goto("/demo/doctor/visits/demo-featured?step=plan");
    await expect(
      page.getByRole("button", { name: "إنهاء الزيارة", exact: true })
    ).toBeVisible();
    await page.evaluate((failure) => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      Object.assign(window, {
        restoreStorage: () => {
          Storage.prototype.getItem = get;
          Storage.prototype.setItem = set;
        },
      });
      Storage.prototype.getItem = function (key) {
        if (failure === "read" && key === "mayanaa-demo-v1:public")
          throw new DOMException("Synthetic read failure", "SecurityError");
        return get.call(this, key);
      };
      Storage.prototype.setItem = function (key, value) {
        if (
          (failure === "draft-write" &&
            key.startsWith("mayanaa-demo-visit-v1:")) ||
          (failure === "queue-write" && key === "mayanaa-demo-v1:public")
        )
          throw new DOMException(
            "Synthetic write failure",
            "QuotaExceededError"
          );
        set.call(this, key, value);
      };
    }, failure);
    if (failure === "queue-write") {
      await page
        .getByRole("button", { name: "إنهاء الزيارة", exact: true })
        .click();
      await page
        .getByRole("button", { name: "حفظ وإنهاء الزيارة", exact: true })
        .click();
      await expectFailedCompletion(page);
    } else {
      // Draft autosave drives the actual store read/write failure, not a mock store.
      await page
        .getByRole("link", { name: "القياسات والملاحظات", exact: true })
        .click();
      await page
        .locator("textarea")
        .fill("Fictional tab-local draft during failure");
      await expect(page.getByRole("alert").filter({ hasText: "لم تُحفظ تعديلاتك" })).toBeVisible();
    }
    const other = await context.newPage();
    await finishSeed(other);
    await other.goto("/demo/secretary");
    await other
      .getByRole("button", { name: "إدخال عند الطبيب", exact: true })
      .click();
    await expect(
      other.getByRole("heading", { name: "عند الطبيب (1)", exact: true })
    ).toBeVisible();
    const committed = await other.evaluate(() =>
      localStorage.getItem("mayanaa-demo-v1:public")
    );
    await page.evaluate(() =>
      (window as Window & { restoreStorage?: () => void }).restoreStorage!()
    );
    if (failure !== "queue-write") {
      await page
        .getByRole("link", { name: "البرنامج والموعد", exact: true })
        .click();
      await page
        .getByRole("button", { name: "إنهاء الزيارة", exact: true })
        .click();
      await page
        .getByRole("button", { name: "حفظ وإنهاء الزيارة", exact: true })
        .click();
      await expectFailedCompletion(page);
    } else {
      // Reset is another whole-store mutation, and must not flush stale memory.
      await accountAfterLocalFailure(page);
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: "إعادة ضبط العرض التجريبي", exact: true })
        .click();
    }
    expect(
      await other.evaluate(() => localStorage.getItem("mayanaa-demo-v1:public"))
    ).toBe(committed);
    // Reload explicitly discards the isolated fallback and recovers authoritative disk state.
    if (failure !== "queue-write") page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await page.goto("/demo/doctor");
    await expect(page.locator(".doctor-current")).toContainText("سامر درويش");
  });
}

for (const failure of ["missing", "rejected"] as const) {
  test(`${failure} Web Lock rejects completion and keeps subsequent edits browser-tab-local`, async ({
    page,
    context,
  }) => {
    await page.goto("/demo/doctor/visits/demo-featured?step=plan");
    await expect(
      page.getByRole("button", { name: "إنهاء الزيارة", exact: true })
    ).toBeVisible();
    const before = await page.evaluate(() =>
      localStorage.getItem("mayanaa-demo-v1:public")
    );
    await page.evaluate((failure) => {
      const locks = navigator.locks;
      Object.assign(window, {
        restoreLocks: () =>
          Object.defineProperty(navigator, "locks", {
            configurable: true,
            value: locks,
          }),
      });
      Object.defineProperty(navigator, "locks", {
        configurable: true,
        value:
          failure === "missing"
            ? undefined
            : {
                request: () =>
                  Promise.reject(
                    new DOMException("Synthetic lock failure", "SecurityError")
                  ),
              },
      });
    }, failure);
    await page
      .getByRole("button", { name: "إنهاء الزيارة", exact: true })
      .click();
    await page
      .getByRole("button", { name: "حفظ وإنهاء الزيارة", exact: true })
      .click();
    await expectFailedCompletion(page);
    await page.getByRole("link", { name: "القياسات والملاحظات", exact: true }).click();
    await page.getByLabel("ملاحظاتي", { exact: true }).fill("Fictional local edit without locks");
    await expect(page.getByRole("alert").filter({ hasText: "لم تُحفظ تعديلاتك" })).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("mayanaa-demo-v1:public"))
    ).toBe(before);
    const other = await context.newPage();
    await finishSeed(other);
    await other.goto("/demo/secretary");
    await other
      .getByRole("button", { name: "إدخال عند الطبيب", exact: true })
      .click();
    await expect(
      other.getByRole("heading", { name: "عند الطبيب (1)", exact: true })
    ).toBeVisible();
    const committed = await other.evaluate(() =>
      localStorage.getItem("mayanaa-demo-v1:public")
    );
    await page.evaluate(() =>
      (window as Window & { restoreLocks?: () => void }).restoreLocks!()
    );
    await accountAfterLocalFailure(page);
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "إعادة ضبط العرض التجريبي", exact: true })
      .click();
    expect(
      await other.evaluate(() => localStorage.getItem("mayanaa-demo-v1:public"))
    ).toBe(committed);
    await page.reload();
    await page.goto("/demo/doctor");
    await expect(page.locator(".doctor-current")).toContainText("سامر درويش");
  });
}
