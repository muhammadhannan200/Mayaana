import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Doctor Home agenda uses fictional browser-local records, RTL, dates and patient links", async ({
  page,
}, testInfo) => {
  await page.clock.install({ time: new Date("2026-11-03T21:00:00Z") });
  let serverActions = 0;
  page.on("request", (request) => {
    if (request.headers()["next-action"]) serverActions++;
  });
  await page.addInitScript(() => {
    const patient = (
      id: string,
      name: string,
      date: string,
      appointment: string
    ) => ({
      id,
      name,
      phone: "+12025550101",
      height: "170",
      gender: "female",
      birthYear: "1990",
      goal: "نقص وزن",
      visits: [
        {
          id: `${id}-visit`,
          number: 1,
          date,
          detailDate: "زيارة خيالية",
          measurements: {},
          appointment,
        },
      ],
    });
    localStorage.setItem(
      "mayanaa-demo-v1:public",
      JSON.stringify({
        patients: [
          patient("today", "خيالي متوقع", "2026-10-01", "2026-11-04"),
          patient("overdue", "خيالي متأخر", "2026-10-01", "2026-11-01"),
          patient("arrived", "خيالي وصل", "2026-10-01", "2026-11-04"),
          patient("completed", "خيالي مكتمل", "2026-11-03", "2026-11-01"),
          patient("future", "خيالي قادم", "2026-10-01", "2026-11-05"),
        ],
        queue: [
          {
            id: "arrived-entry",
            patientId: "arrived",
            kind: "full_exam",
            status: "waiting",
            measurements: {},
          },
        ],
      })
    );
  });
  await page.goto("/demo/doctor");
  const today = page.getByRole("region", {
    name: "متوقع اليوم (1)",
    exact: true,
  });
  const overdue = page.getByRole("region", { name: "متأخر (1)", exact: true });
  await expect(
    today.getByRole("link", { name: /خيالي متوقع/ })
  ).toHaveAttribute("href", "/demo/doctor/patients/today");
  await expect(today.locator("time")).toHaveText("2026-11-04");
  await expect(
    overdue.getByRole("link", { name: /خيالي متأخر/ })
  ).toHaveAttribute("href", "/demo/doctor/patients/overdue");
  await expect(overdue.locator("time")).toHaveAttribute(
    "datetime",
    "2026-11-01"
  );
  await expect(page.getByRole("main")).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1
    )
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("doctor-agenda.png"),
    fullPage: true,
  });
  await today.getByRole("link").click();
  await expect(page).toHaveURL(/\/demo\/doctor\/patients\/today$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "خيالي متوقع"
  );
  expect(
    serverActions,
    "Public demo must never invoke authenticated agenda actions"
  ).toBe(0);
});

test("empty agenda is explicit Arabic, never a seeded real-clinic fallback", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mayanaa-demo-v1:public",
      JSON.stringify({ patients: [], queue: [] })
    )
  );
  await page.goto("/demo/doctor");
  await expect(
    page.getByText("لا يوجد مرضى متوقعون اليوم لم يصلوا بعد.")
  ).toBeVisible();
  await expect(
    page.getByText("لا توجد مواعيد متأخرة دون زيارة مكتملة أو موعد لاحق.")
  ).toBeVisible();
});

test("visible demo advances at Damascus midnight without rewriting stored appointments", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-03T20:59:00Z") });
  await page.clock.pauseAt(new Date("2026-11-03T20:59:59Z"));
  await page.addInitScript(() =>
    localStorage.setItem(
      "mayanaa-demo-v1:public",
      JSON.stringify({
        patients: [
          {
            id: "midnight",
            name: "منتظر خيالي",
            phone: "",
            height: "170",
            gender: "female",
            birthYear: "1990",
            goal: "",
            visits: [
              {
                id: "v",
                number: 1,
                date: "2026-10-01",
                detailDate: "زيارة خيالية",
                measurements: {},
                appointment: "2026-11-03",
              },
            ],
          },
        ],
        queue: [],
      })
    )
  );
  await page.goto("/demo/doctor");
  await expect(
    page
      .getByRole("region", { name: "متوقع اليوم (1)", exact: true })
      .getByRole("link")
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    localStorage.getItem("mayanaa-demo-v1:public")
  );
  await page.clock.fastForward(11_000);
  await expect(
    page
      .getByRole("region", { name: "متأخر (1)", exact: true })
      .getByRole("link")
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("mayanaa-demo-v1:public"))
  ).toBe(stored);
});
