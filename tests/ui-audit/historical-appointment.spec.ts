import { expect, test, type Page } from "@playwright/test";

const entryId = "fictional-history-appointment";
const notes = "ملاحظات خيالية محفوظة للاختبار";

async function openVisit(
  page: Page,
  followUpDate: string,
  status: "completed" | "with_doctor" = "completed"
) {
  const errors: string[] = [];
  const writes: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
      writes.push(request.url());
  });
  await page.addInitScript(
    ({ entryId, followUpDate, status, notes }) => {
      if (localStorage.getItem("mayanaa-demo-v1:public")) return;
      localStorage.setItem(
        "mayanaa-demo-v1:public",
        JSON.stringify({
          patients: [
            {
              id: "fictional-history-patient",
              name: "مريض خيالي",
              phone: "",
              height: "165",
              gender: "female",
              birthYear: "1990",
              goal: "نقص وزن",
              visits: [],
            },
          ],
          queue: [
            {
              id: entryId,
              patientId: "fictional-history-patient",
              kind: "follow_up",
              status,
              measurements: { weight: "65" },
              visit: {
                notes,
                appointment: followUpDate,
                completedAt:
                  status === "completed" ? "2026-10-10T21:30:00Z" : undefined,
                days: [
                  {
                    id: "fictional-day",
                    meals: [
                      {
                        id: "fictional-meal",
                        type: "فطور",
                        description: "وجبة خيالية محفوظة",
                      },
                    ],
                  },
                ],
              },
            },
          ],
        })
      );
    },
    { entryId, followUpDate, status, notes }
  );
  await page.goto(
    `/demo/doctor/visits/${entryId}${status === "with_doctor" ? "?step=plan" : ""}`
  );
  await expect(
    page.getByRole("heading", {
      name: status === "completed" ? "الزيارة المكتملة" : "زيارة اليوم",
      exact: true,
    })
  ).toBeVisible();
  return { errors, writes };
}

test("completed visit without a saved appointment never invents one", async ({
  page,
}) => {
  const { errors, writes } = await openVisit(page, "");
  await expect(page.locator(".visit-appointment p")).toHaveText(
    "لم يُحدّد موعد متابعة"
  );
  await expect(page.locator(".visit-appointment")).not.toContainText(
    "يُحسب تلقائياً"
  );
  await expect(page.getByLabel("ملاحظاتي")).toHaveValue(notes);
  await expect(page.getByLabel("ملاحظاتي")).toHaveAttribute("readonly", "");
  await expect(page.locator(".visit-meal")).toContainText("وجبة خيالية محفوظة");
  await expect(page.getByLabel("تعديل التاريخ")).toHaveCount(0);
  const stored = await page.evaluate(() =>
    localStorage.getItem("mayanaa-demo-v1:public")
  );
  await page.reload();
  await expect(page.locator(".visit-appointment p")).toHaveText(
    "لم يُحدّد موعد متابعة"
  );
  expect(
    await page.evaluate(() => localStorage.getItem("mayanaa-demo-v1:public"))
  ).toBe(stored);
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test("completed visit displays the actual saved appointment after reload", async ({
  page,
}) => {
  const { errors, writes } = await openVisit(page, "2026-10-24");
  await expect(page.locator(".visit-appointment p")).toHaveText("24/10/2026");
  await expect(page.locator(".visit-appointment")).not.toContainText(
    "يُحسب تلقائياً"
  );
  await page.reload();
  await expect(page.locator(".visit-appointment p")).toHaveText("24/10/2026");
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

for (const appointment of ["", "2026-10-24"]) {
  test(`historical appointment stays fixed across calendar changes: ${appointment || "absent"}`, async ({
    page,
  }) => {
    const { errors, writes } = await openVisit(page, appointment);
    const stored = await page.evaluate(() =>
      localStorage.getItem("mayanaa-demo-v1:public")
    );
    for (const now of ["2030-01-20T12:00:00Z", "2030-01-21T12:00:00Z"]) {
      await page.clock.setFixedTime(new Date(now));
      // Client navigation remounts the editor after the clock changes, without
      // conflating this regression with #55's separate SSR fixture-clock issue.
      await page
        .getByRole("link", { name: "العودة للرئيسية", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "الزيارة المكتملة", exact: true })
      ).toHaveCount(0);
      await page.goBack();
      await expect(page.locator(".visit-appointment p")).toHaveText(
        appointment ? "24/10/2026" : "لم يُحدّد موعد متابعة"
      );
      await expect(page.locator(".visit-appointment")).not.toContainText(
        "يُحسب تلقائياً"
      );
    }
    expect(
      await page.evaluate(() => localStorage.getItem("mayanaa-demo-v1:public"))
    ).toBe(stored);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}

test("active suggestions, custom dates, validation and final save are unchanged", async ({
  page,
}) => {
  const { errors, writes } = await openVisit(page, "", "with_doctor");
  await page.clock.setFixedTime(new Date("2030-01-20T12:00:00Z"));
  await page
    .getByRole("link", { name: "القياسات والملاحظات", exact: true })
    .click();
  await expect(page.getByLabel("ملاحظاتي")).toHaveValue(notes);
  await page
    .getByRole("link", { name: "متابعة للبرنامج والموعد", exact: true })
    .click();
  const date = page.getByLabel("تعديل التاريخ");
  await expect(date).toHaveValue("2030-01-21");
  await expect(date).toHaveAttribute("min", "2030-01-21");
  await expect(page.locator(".visit-appointment")).toContainText(
    "يُحسب تلقائياً"
  );
  await date.fill("2030-01-20");
  await page
    .getByRole("button", { name: "إنهاء الزيارة", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "اختر موعد مراجعة بعد اليوم."
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await date.fill("2030-01-25");
  await page
    .getByRole("button", { name: "إنهاء الزيارة", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("25/1/2030");
  await page
    .getByRole("button", { name: "حفظ وإنهاء الزيارة", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "الزيارة المكتملة", exact: true })
  ).toBeVisible();
  await expect(page.locator(".visit-appointment p")).toHaveText("25/1/2030");
  await expect(page.getByLabel("ملاحظاتي")).toHaveValue(notes);
  await expect(page.locator(".visit-meal")).toContainText("وجبة خيالية محفوظة");
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});
