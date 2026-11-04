import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const secret = "PRIVATE-DEMO-NOTE-DO-NOT-PRINT-92a1";

test("completed demo print is notes-free, browser-local, RTL and printable", async ({
  page,
}, info) => {
  const unexpected: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" ||
      /supabase|\/rest\/v1\/|\/auth\/v1\//.test(request.url())
    )
      unexpected.push(request.url());
  });
  await page.goto("/demo/doctor/visits/demo-featured");
  await page.getByLabel("ملاحظاتي").fill(secret);
  await page.getByRole("link", { name: "متابعة للبرنامج والموعد" }).click();
  await page
    .getByRole("button", { name: "إنهاء الزيارة", exact: true })
    .click();
  await page.getByRole("button", { name: "حفظ وإنهاء الزيارة" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "الزيارة المكتملة"
  );
  await page.getByRole("link", { name: "طباعة البرنامج" }).click();
  await expect(page).toHaveURL(/\/demo\/doctor\/visits\/demo-featured\/print$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "البرنامج الغذائي"
  );
  await expect(page.getByRole("main")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("نور الحسن", { exact: true })).toBeVisible();
  await expect(page.getByText("بيضتان مسلوقتان، خبز أسمر وخيار")).toBeVisible();
  await expect(page.getByText("موعد المراجعة القادمة")).toBeVisible();
  expect(await page.content()).not.toContain(secret);
  expect(
    await page.evaluate(() => localStorage.getItem("mayanaa-demo-v1:public"))
  ).toContain(secret);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "البرنامج الغذائي"
  );
  expect(await page.content()).not.toContain(secret);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1
    )
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("print-screen.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printCalled = "yes";
    };
  });
  await page.getByRole("button", { name: "طباعة", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-print-called",
    "yes"
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "طباعة", exact: true })
  ).toBeHidden();
  await expect(page.getByRole("article")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("print-paper.png"),
    fullPage: true,
  });
  expect(unexpected).toEqual([]);
});

test("unfinished and missing demo visits do not expose a plan or print control", async ({
  page,
}) => {
  for (const [id, message] of [
    ["demo-featured", "لا يمكن طباعة البرنامج قبل اكتمال الزيارة."],
    ["missing", "الزيارة غير متاحة."],
  ]) {
    await page.goto(`/demo/doctor/visits/${id}/print`);
    await expect(page.getByRole("status")).toContainText(message);
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "طباعة", exact: true })
    ).toHaveCount(0);
  }
});

test("signed-out live print never falls back to demo data", async ({
  page,
}) => {
  await page.goto("/doctor/visits/11111111-1111-4111-8111-111111111111/print");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("multi-day demo produces A4 pages with intact meal break rules", async ({
  page,
}, info) => {
  await page.goto("/demo/doctor");
  await page.evaluate((secret) => {
    localStorage.setItem(
      "mayanaa-demo-v1:public",
      JSON.stringify({
        patients: [
          { id: "print-patient", name: "مريض خيالي لبرنامج طويل", visits: [] },
        ],
        queue: [
          {
            id: "print-long",
            patientId: "print-patient",
            status: "completed",
            measurements: {},
            kind: "full_exam",
            visit: {
              notes: secret,
              completedAt: "2026-11-04T09:00:00Z",
              appointment: "2026-11-18",
              days: Array.from({ length: 8 }, (_, index) => ({
                id: `day-${index}`,
                meals: Array.from({ length: 5 }, (_, meal) => ({
                  id: `meal-${index}-${meal}`,
                  type: "غداء",
                  description: "وجبة خيالية لا تستخدم للعلاج. ".repeat(15),
                })),
              })),
            },
          },
        ],
      })
    );
  }, secret);
  await page.goto("/demo/doctor/visits/print-long/print");
  await expect(page.getByRole("article")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "اليوم 8", exact: true })
  ).toBeVisible();
  expect(await page.content()).not.toContain(secret);
  await page.emulateMedia({ media: "print" });
  expect(
    await page
      .locator(".print-meal")
      .first()
      .evaluate((node) => getComputedStyle(node).breakInside)
  ).toBe("avoid");
  const pdf = await page.pdf({
    path: info.outputPath("multi-day-a4.pdf"),
    preferCSSPageSize: true,
  });
  const source = pdf.toString("latin1");
  expect(source.match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
  const mediaBox = /\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/.exec(source)!;
  expect(Number(mediaBox[1])).toBeCloseTo(595, -1);
  expect(Number(mediaBox[2])).toBeCloseTo(842, -1);
});
