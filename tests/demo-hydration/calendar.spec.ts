import {
  expect,
  test as base,
  type Locator,
  type Page,
} from "@playwright/test";
import { createDemoFixture } from "../../lib/demo-fixture";

const key = "mayanaa-demo-v1:public";
const test = base.extend<{ cleanHydration: void }>({
  cleanHydration: [
    async ({ context }, use) => {
      const errors: string[] = [];
      const writes: string[] = [];
      context.on("page", (page) => {
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
      });
      await context.route("**/*", (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
          writes.push(`external ${url.origin}`);
          return route.abort();
        }
        if (!["GET", "HEAD", "OPTIONS"].includes(request.method()))
          writes.push(`${request.method()} ${url.pathname}`);
        return route.continue();
      });
      await use();
      expect(
        errors,
        "no React hydration errors or other browser errors"
      ).toEqual([]);
      expect(
        writes,
        "demo never calls external services or server mutations"
      ).toEqual([]);
    },
    { auto: true },
  ],
});

async function clock(page: Page, instant = "2024-02-28T23:30:00.000Z") {
  await page.clock.setFixedTime(new Date(instant));
}

async function activate(control: Locator) {
  // The default development indicator overlaps fixed footer controls at 320px.
  // Exercise real keyboard activation in dev, and ordinary pointer actionability
  // in production. Never force clicks, hide overlays or relax error assertions.
  if (process.env.UI_AUDIT_PRODUCTION === "1") await control.click();
  else await control.press("Enter");
}

test("same instant, different server/browser timezones: direct Doctor Patients", async ({
  page,
}) => {
  await clock(page);
  await page.goto("/demo/doctor/patients");
  await expect(
    page.locator(".patient-result").filter({ hasText: "سامر درويش" })
  ).toContainText("2024-02-15");
  await expect(
    page.locator(".patient-result").filter({ hasText: "مريم العلي" })
  ).toContainText("2024-02-29");
  await page.reload();
  await expect(
    page.locator(".patient-result").filter({ hasText: "سامر درويش" })
  ).toContainText("2024-02-15");
});

for (const [label, instant, today, previous, appointment, tomorrow] of [
  [
    "midnight",
    "2024-02-29T00:01:00Z",
    "2024-02-29",
    "2024-02-15",
    "2024-03-14",
    "2024-03-01",
  ],
  [
    "month",
    "2024-03-31T21:01:00Z",
    "2024-04-01",
    "2024-03-18",
    "2024-04-15",
    "2024-04-02",
  ],
  [
    "year",
    "2024-12-31T21:01:00Z",
    "2025-01-01",
    "2024-12-18",
    "2025-01-15",
    "2025-01-02",
  ],
  [
    "leap day",
    "2024-02-29T21:01:00Z",
    "2024-03-01",
    "2024-02-16",
    "2024-03-15",
    "2024-03-02",
  ],
]) {
  test(`${label}: direct history and visit plan use browser-local dates`, async ({
    page,
  }) => {
    await clock(page, instant);
    await page.goto("/demo/doctor/patients/demo-noor");
    await expect(page.locator(".demo-visit-history")).toContainText(previous);
    await expect(page.locator(".demo-patient-info")).toContainText(
      `${Number(today.slice(0, 4)) - 1994} سنة`
    );
    await page.goto("/demo/doctor/visits/demo-featured?step=plan");
    await expect(page.getByLabel("تاريخ الموعد")).toHaveValue(appointment);
    await page.reload();
    await expect(page.getByLabel("تاريخ الموعد")).toHaveValue(appointment);
    await page
      .getByRole("link", { name: "القياسات والملاحظات", exact: true })
      .click();
    await page.getByLabel("ملاحظاتي").fill("زيارة خيالية دون موعد مخصص");
    await expect(page.getByLabel("ملاحظاتي")).toHaveValue(
      "زيارة خيالية دون موعد مخصص"
    );
    await page.evaluate((key) => {
      const saved = JSON.parse(localStorage.getItem(key)!);
      saved.queue.find(
        (entry: { id: string }) => entry.id === "demo-featured"
      ).visit.appointment = "";
      localStorage.setItem(key, JSON.stringify(saved));
    }, key);
    await page.goto("/demo/doctor/visits/demo-featured?step=plan");
    await expect(page.getByLabel("تاريخ الموعد")).toHaveValue(tomorrow);
    await expect(page.getByLabel("تاريخ الموعد")).toHaveAttribute(
      "min",
      tomorrow
    );
  });
}

for (const storage of [
  "empty",
  "malformed",
  "invalid shape",
  "unavailable",
] as const) {
  test(`${storage} storage keeps a functional today-relative demo`, async ({
    page,
  }) => {
    await clock(page);
    await page.addInitScript(
      ({ key, storage }) => {
        if (storage === "unavailable") {
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new DOMException("Test storage denied", "SecurityError");
            },
          });
        } else if (storage === "malformed") localStorage.setItem(key, "{");
        else if (storage === "invalid shape")
          localStorage.setItem(key, '{"patients":[],"queue":[{}]}');
      },
      { key, storage }
    );
    await page.goto("/demo/doctor/patients/demo-noor");
    await expect(page.locator(".demo-visit-history")).toContainText(
      "2024-02-15"
    );
    await page.goto("/demo/doctor/visits/demo-featured?step=plan");
    await expect(page.getByLabel("تاريخ الموعد")).toHaveValue("2024-03-14");
    await page
      .getByRole("link", { name: "القياسات والملاحظات", exact: true })
      .click();
    const notes = page.getByLabel("ملاحظاتي");
    await notes.fill("ملاحظة خيالية محفوظة في الذاكرة");
    await expect(notes).toHaveValue("ملاحظة خيالية محفوظة في الذاكرة");
    // Use the identical top navigation destination: Next's development badge
    // overlaps the fixed footer link at 320px. Do not force clicks through it.
    await page
      .getByRole("link", { name: "البرنامج والموعد", exact: true })
      .click();
    await expect(page).toHaveURL(/\?step=plan$/);
    await expect(page.getByLabel("تاريخ الموعد")).toHaveValue("2024-03-14");
    await page.goBack();
    await expect(page).toHaveURL(/\/visits\/demo-featured$/);
    await expect(notes).toHaveValue("ملاحظة خيالية محفوظة في الذاكرة");
  });
}

test("valid storage wins; notes autosave survives reload/navigation; reset synchronizes tabs", async ({
  page,
  context,
}) => {
  await clock(page);
  await page.goto("/demo/doctor/visits/demo-featured?step=plan");
  await expect(page.getByLabel("تاريخ الموعد")).toHaveValue("2024-03-14");
  await page
    .getByRole("link", { name: "القياسات والملاحظات", exact: true })
    .click();
  await page.getByLabel("ملاحظاتي").fill("ملاحظة خيالية محفوظة");
  const raw = await page.evaluate((key) => localStorage.getItem(key), key);
  expect(raw).not.toBeNull();
  await page.reload();
  await expect(page.getByLabel("ملاحظاتي")).toHaveValue("ملاحظة خيالية محفوظة");
  const other = await context.newPage();
  await clock(other, "2025-01-01T01:00:00Z");
  await other.goto("/demo/doctor/visits/demo-featured");
  await expect(other.getByLabel("ملاحظاتي")).toHaveValue(
    "ملاحظة خيالية محفوظة"
  );
  await other.getByLabel("ملاحظاتي").fill("تعديل من تبويب آخر");
  await expect(page.getByLabel("ملاحظاتي")).toHaveValue("تعديل من تبويب آخر");
  await page.goto("/demo/secretary/account");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "إعادة ضبط العرض التجريبي" }).click();
  await expect(other.getByLabel("ملاحظاتي")).toHaveValue(/نزول تدريجي جيد/);
  await page.goto("/demo/doctor/patients");
  await expect(
    page.locator(".patient-result").filter({ hasText: "سامر درويش" })
  ).toContainText("2024-12-18");
  await page.getByRole("link", { name: /نور الحسن/ }).click();
  await expect(page.locator(".demo-visit-history")).toContainText("2024-12-18");
  await page.goBack();
  await expect(page).toHaveURL(/\/doctor\/patients$/);
  await page.goForward();
  await expect(page.locator(".demo-visit-history")).toContainText("2024-12-18");
});

test.describe("same timezone across midnight", () => {
  test.use({ timezoneId: "UTC" });
  test("server yesterday and browser today hydrate direct routes without replaying server dates", async ({
    page,
  }) => {
    await clock(page, "2024-02-29T00:01:00Z");
    await page.goto("/demo/doctor/patients");
    await expect(
      page.locator(".patient-result").filter({ hasText: "مريم العلي" })
    ).toContainText("2024-02-29");
    await page.goto("/demo/doctor/patients/demo-noor");
    await expect(page.locator(".demo-visit-history")).toContainText(
      "2024-02-15"
    );
    await page.goto("/demo/doctor/visits/demo-featured?step=plan");
    await expect(page.getByLabel("تاريخ الموعد")).toHaveValue("2024-03-14");
  });
});

test.describe("same loaded session across local midnight", () => {
  test.use({ timezoneId: "UTC" });

  for (const [name, custom, after, accepted] of [
    ["default", "", "2024-03-02", true],
    ["custom future", "2024-03-10", "2024-03-10", true],
    ["custom now today", "2024-03-01", "2024-03-01", false],
  ] as const) {
    test(`${name}: live default, minimum and completion agree without reload`, async ({
      page,
    }) => {
      const saved = createDemoFixture("2024-02-29");
      saved.queue.find(
        (entry) => entry.id === "demo-featured"
      )!.visit!.appointment = custom;
      await page.addInitScript(
        ({ key, saved }) => {
          if (!localStorage.getItem(key))
            localStorage.setItem(key, JSON.stringify(saved));
        },
        { key, saved }
      );
      await page.clock.install({ time: new Date("2024-02-29T23:58:00Z") });
      await page.goto("/demo/doctor/visits/demo-featured?step=plan");
      const date = page.getByLabel("تاريخ الموعد");
      await expect(date).toHaveValue(custom || "2024-03-01");
      await expect(date).toHaveAttribute("min", "2024-03-01");
      const before = await page.evaluate(
        (key) => localStorage.getItem(key),
        key
      );
      await page.clock.pauseAt("2024-02-29T23:59:59Z");
      await page.clock.runFor(2000);
      await page.clock.resume();
      // This is the SAME document/store: no reload, navigation or storage event.
      await expect(date).toHaveAttribute("min", "2024-03-02");
      await expect(date).toHaveValue(after);
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
        before
      );
      await activate(
        page.getByRole("button", { name: "إنهاء الزيارة", exact: true })
      );
      if (!accepted) {
        await expect(
          page.getByText("اختر موعد مراجعة بعد اليوم.", { exact: true })
        ).toBeVisible();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(date).toHaveValue(custom);
        await date.fill("2024-03-02");
        await activate(
          page.getByRole("button", { name: "إنهاء الزيارة", exact: true })
        );
      }
      const review = page.getByRole("dialog");
      await expect(review).toBeVisible();
      await expect(review).toContainText(accepted ? after : "2024-03-02");
      await activate(
        review.getByRole("button", { name: "حفظ وإنهاء الزيارة", exact: true })
      );
      await expect(page.getByRole("status")).toContainText("اكتملت الزيارة");
      const completed = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        key
      );
      expect(
        completed.queue.find(
          (entry: { id: string }) => entry.id === "demo-featured"
        ).visit.appointment
      ).toBe(accepted ? after : "2024-03-02");
      expect(
        completed.queue.find(
          (entry: { id: string }) => entry.id === "demo-ready"
        )
      ).toEqual(saved.queue.find((entry) => entry.id === "demo-ready"));
    });
  }

  test("focus, visible resume and pageshow refresh the same document without overwriting custom dates", async ({
    page,
  }) => {
    const saved = createDemoFixture("2024-02-29");
    saved.queue.find(
      (entry) => entry.id === "demo-featured"
    )!.visit!.appointment = "2024-03-10";
    await page.addInitScript(
      ({ key, saved }) => {
        if (!localStorage.getItem(key))
          localStorage.setItem(key, JSON.stringify(saved));
      },
      { key, saved }
    );
    await page.clock.install({ time: new Date("2024-02-29T23:58:00Z") });
    await page.goto("/demo/doctor/visits/demo-featured?step=plan");
    const date = page.getByLabel("تاريخ الموعد");
    await expect(date).toHaveValue("2024-03-10");
    await expect(date).toHaveAttribute("min", "2024-03-01");
    await page.clock.pauseAt("2024-02-29T23:59:59Z");
    const before = await page.evaluate((key) => localStorage.getItem(key), key);
    for (const [event, instant, min] of [
      ["focus", "2024-03-01T08:00:00Z", "2024-03-02"],
      ["visibilitychange", "2024-03-02T08:00:00Z", "2024-03-03"],
      ["pageshow", "2024-03-03T08:00:00Z", "2024-03-04"],
    ]) {
      // Simulate timers missed while asleep, then deliver the browser's resume
      // signal. No route change, reload or persisted-state write is involved.
      await page.clock.setSystemTime(instant);
      await page.evaluate((event) => {
        (event === "visibilitychange" ? document : window).dispatchEvent(
          new Event(event)
        );
      }, event);
      await expect(date).toHaveAttribute("min", min);
      await expect(date).toHaveValue("2024-03-10");
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
        before
      );
    }
    await page.clock.resume();
    await activate(
      page.getByRole("button", { name: "إنهاء الزيارة", exact: true })
    );
    await expect(page.getByRole("dialog")).toContainText("2024-03-10");
  });

  test("confirmation crossing midnight revalidates a custom date before writing", async ({
    page,
  }) => {
    const saved = createDemoFixture("2024-02-29");
    saved.queue.find(
      (entry) => entry.id === "demo-featured"
    )!.visit!.appointment = "2024-03-01";
    await page.addInitScript(
      ({ key, saved }) => {
        if (!localStorage.getItem(key))
          localStorage.setItem(key, JSON.stringify(saved));
      },
      { key, saved }
    );
    await page.clock.install({ time: new Date("2024-02-29T23:58:00Z") });
    await page.goto("/demo/doctor/visits/demo-featured?step=plan");
    const date = page.getByLabel("تاريخ الموعد");
    await expect(date).toHaveValue("2024-03-01");
    await expect(date).toHaveAttribute("min", "2024-03-01");
    await activate(
      page.getByRole("button", { name: "إنهاء الزيارة", exact: true })
    );
    await expect(page.getByRole("dialog")).toBeVisible();
    const before = await page.evaluate((key) => localStorage.getItem(key), key);
    await page.clock.pauseAt("2024-02-29T23:59:59Z");
    await page.clock.setSystemTime("2024-03-01T08:00:00Z");
    // Deliberately do not run any midnight timer or resume event. The final
    // confirmation itself must check the calendar before mutating local state.
    await activate(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "حفظ وإنهاء الزيارة", exact: true })
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByText("اختر موعد مراجعة بعد اليوم.", { exact: true })
    ).toBeVisible();
    await expect(date).toHaveValue("2024-03-01");
    await expect(date).toHaveAttribute("min", "2024-03-02");
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      before
    );
    await page.clock.resume();
  });
});
