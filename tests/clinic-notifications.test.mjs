import assert from "node:assert/strict";
import { test } from "node:test";
import { clinicNotifications } from "../shared/clinic-notifications.ts";

const entry = (id, status, doctorOpened) => ({
  id,
  patientId: id,
  kind: "follow_up",
  status,
  doctorOpened,
  measurements: {},
});
const name = (row) => `مريض ${row.id}`;

test("doctor hears about the queue", () => {
  const items = clinicNotifications(
    "doctor",
    [entry("a", "waiting"), entry("b", "ready"), entry("c", "completed")],
    name
  );
  assert.deepEqual(
    items.map((item) => item.text),
    ["مريض b جاهز للدخول، اكتملت القياسات", "أُضيف مريض a إلى الدور"]
  );
});

test("secretary hears about visits opened and finished", () => {
  const items = clinicNotifications(
    "secretary",
    [
      entry("a", "with_doctor", true),
      entry("b", "completed"),
      entry("c", "waiting"),
    ],
    name
  );
  assert.deepEqual(
    items.map((item) => item.text),
    ["انتهت زيارة مريض b", "فتح الطبيب زيارة مريض a"]
  );
});

test("a status change creates a new notification id", () => {
  const before = clinicNotifications("doctor", [entry("a", "waiting")], name);
  const after = clinicNotifications("doctor", [entry("a", "ready")], name);
  assert.notEqual(before[0].id, after[0].id);
});
