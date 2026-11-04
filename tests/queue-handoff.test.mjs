import { test } from "node:test";
import assert from "node:assert/strict";
import { handoffQueue } from "../lib/queue-handoff.ts";

const ready = id => ({ id, patientId: id, kind: "full_exam", status: "ready", measurements: { weight: "80" } });

test("sequential demo handoffs preserve the occupied slot and waiting data", () => {
  const first = handoffQueue([ready("a"), ready("b")], "a");
  assert.equal(first.outcome, "sent");
  const blocked = handoffQueue(first.queue, "b");
  assert.equal(blocked.outcome, "occupied"); assert.equal(blocked.queue, first.queue);
  assert.equal(blocked.queue[1].status, "ready");
});
test("same-entry retries do not reopen completed visits or change other entries", () => {
  const active = handoffQueue([ready("a"), ready("b")], "a");
  assert.equal(handoffQueue(active.queue, "a").outcome, "retry");
  const completed = active.queue.map(entry => entry.id === "a" ? { ...entry, status: "completed" } : entry);
  const next = handoffQueue(completed, "b");
  assert.equal(next.outcome, "sent");
  const delayed = handoffQueue(next.queue, "a");
  assert.equal(delayed.outcome, "retry"); assert.equal(delayed.queue, next.queue);
});
test("separate demo scopes have independent slots; unready and unknown entries cannot enter", () => {
  assert.equal(handoffQueue([ready("a")], "a").outcome, "sent");
  assert.equal(handoffQueue([ready("b")], "b").outcome, "sent");
  assert.equal(handoffQueue([{ ...ready("a"), status: "waiting" }], "a").outcome, "unavailable");
  assert.equal(handoffQueue([], "missing").outcome, "unavailable");
});

test("neutral handoff contract preserves caller-owned fields without Demo fixtures", () => {
  const metadata = { revision: 7, request: "synthetic-request" };
  const queue = [{ id: "a", status: "ready", metadata }, { id: "b", status: "waiting", metadata }];
  const next = handoffQueue(queue, "a");
  assert.equal(next.outcome, "sent");
  assert.equal(queue[0].status, "ready", "The source snapshot stays immutable");
  assert.equal(next.queue[0].metadata, metadata);
  assert.equal(next.queue[1], queue[1]);
});
