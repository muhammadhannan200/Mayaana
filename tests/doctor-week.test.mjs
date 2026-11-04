import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countWeekKinds,
  groupWeekVisits,
  weekStart,
} from "../shared/doctor-week.ts";

const visit = (id, date, kind, arrivalTime) => ({
  id,
  patientId: id,
  name: id,
  date,
  kind,
  arrivalTime,
});

test("the week covers today and the previous six days", () => {
  assert.equal(weekStart("2026-11-04"), "2026-10-29");
});

test("groups newest days first and orders arrivals within a day", () => {
  const groups = groupWeekVisits([
    visit("a", "2026-11-03", "follow_up", "10:00"),
    visit("b", "2026-11-04", "follow_up", "09:00"),
    visit("c", "2026-11-04", "full_exam", "11:00"),
  ]);
  assert.deepEqual(
    groups.map((group) => group.rows.map((row) => row.id)),
    [["c", "b"], ["a"]]
  );
});

test("counts visit kinds", () => {
  assert.deepEqual(
    countWeekKinds([
      visit("a", "2026-11-03", "full_exam"),
      visit("b", "2026-11-03", "follow_up"),
      visit("c", "2026-11-03", "follow_up"),
    ]),
    { fullExam: 1, followUp: 2 }
  );
});
