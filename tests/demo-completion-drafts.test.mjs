import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { handoffQueue } from "../lib/queue-handoff.ts";

function functionSource(path, name) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  function find(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) return node;
    return ts.forEachChild(node, find);
  }
  const declaration = find(source);
  assert.ok(declaration);
  return ts.transpileModule(declaration.getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
}
const storeCode = functionSource("lib/demo-clinic.tsx", "createStore");
const finishCode = functionSource("app/doctor/visit-screen.tsx", "finish");
const key = "mayanaa-demo-v1:public";
const draftKey = "mayanaa-demo-visit-v1:public:fictional-entry";
const seedVisit = {
  notes: "Reviewed notes",
  days: [{ id: "day", meals: [{ id: "meal", type: "فطور", description: "Reviewed meal" }] }],
  appointment: "2026-11-02",
};

function harness() {
  let now = new Date(2026, 10, 1, 10).getTime();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const initial = {
    patients: [{ id: "patient", name: "Synthetic", visits: [] }],
    queue: [{ id: "fictional-entry", patientId: "patient", kind: "follow_up",
      status: "with_doctor", measurements: { weight: "80" }, visit: structuredClone(seedVisit) }],
  };
  const values = new Map([[key, JSON.stringify(initial)]]);
  const pending = [];
  const locks = {
    request(name, callback) {
      assert.equal(name, key);
      return new Promise((resolve, reject) => pending.push({ callback, resolve, reject }));
    },
    async releaseNext() {
      const request = pending.shift();
      assert.ok(request, "Expected a queued completion");
      try { request.resolve(await request.callback()); }
      catch (error) { request.reject(error); }
    },
  };
  const navigator = { locks };
  function tab() {
    const faults = { read: false, write: false };
    const listeners = new Set();
    const createStore = new Function("initial", "handoffQueue", "navigator", "localStorage", "window", "Date",
      `${storeCode}\nreturn createStore;`
    )(
      structuredClone(initial), handoffQueue, navigator,
      {
        getItem(name) {
          if (faults.read) throw new Error("Synthetic read failure");
          return values.get(name) ?? null;
        },
        setItem(name, value) {
          if (faults.write) throw new Error("Synthetic write failure");
          values.set(name, value);
        },
      },
      {
        addEventListener: (_name, listener) => listeners.add(listener),
        removeEventListener: (_name, listener) => listeners.delete(listener),
      }, Clock
    );
    const store = createStore("public");
    store.read();
    store.subscribe(() => {});
    return { store, faults, sync: () => listeners.forEach((listener) => listener({ key: draftKey })) };
  }
  function finish(tab, displayed = structuredClone(tab.store.read().queue[0].visit)) {
    const ui = { error: "", reviewClosed: false, navigations: [], recovery: null };
    const callback = new Function(
      "operations", "local", "update", "entryId", "visit", "appointment", "setReview", "setError",
      "setFailedCompletionDraft", "router", "visitHref", "Date", `${finishCode}\nreturn finish;`
    )(
      undefined, tab.store, tab.store.update, "fictional-entry", displayed, displayed.appointment,
      (value) => { ui.reviewClosed = !value; },
      (value) => { ui.error = value; },
      (value) => { ui.recovery = value; },
      { replace: (href) => ui.navigations.push(href) }, "/demo/doctor/visits/fictional-entry", Clock
    );
    return { ui, done: callback() };
  }
  return {
    tab, finish, values, locks, pending,
    persisted: () => JSON.parse(values.get(key)),
    midnight: () => { now = new Date(2026, 10, 2, 0, 1).getTime(); },
    removeLocks: () => { navigator.locks = undefined; },
  };
}

function assertRejected(h, attempt, expectedDraft) {
  assert.equal(h.persisted().queue[0].status, "with_doctor");
  assert.deepEqual(h.persisted().patients[0].visits, []);
  assert.match(attempt.ui.error, /تغيّرت المسودة|تعذّر تأكيد|تحقق من البرنامج|لم تعد الزيارة/);
  assert.equal(attempt.ui.reviewClosed, false, "Failure must not dismiss review as successful");
  assert.deepEqual(attempt.ui.navigations, [], "Failure must not navigate to success");
  assert.deepEqual(attempt.ui.recovery, expectedDraft, "Keep notes, diet and appointment for recovery");
}

async function saveDraft(h, tab, visit, expected = seedVisit) {
  const saving = tab.store.saveVisit("fictional-entry", () => visit, expected);
  await h.locks.releaseNext();
  return saving;
}

for (const field of ["notes", "days", "appointment"]) {
  test(`a newer ${field} autosave queued before completion makes it reject the captured draft`, async () => {
    const h = harness(), completing = h.tab(), editing = h.tab();
    const displayed = structuredClone(seedVisit);
    const latest = structuredClone(seedVisit);
    if (field === "notes") latest.notes = "New authoritative notes";
    if (field === "days") latest.days[0].meals[0].description = "New authoritative meal";
    if (field === "appointment") latest.appointment = "2026-11-15";
    const saving = editing.store.saveVisit("fictional-entry", () => latest, seedVisit);
    const attempt = h.finish(completing, displayed);
    assert.equal(h.pending.length, 2);
    await h.locks.releaseNext();
    assert.equal(await saving, "saved");
    const before = [...h.values];
    await h.locks.releaseNext();
    await attempt.done;
    assert.deepEqual([...h.values], before, "Rejected completion cannot write either shared key");
    assertRejected(h, attempt, displayed);
    assert.deepEqual(completing.store.read().queue[0].visit, latest);
  });
}

test("storage event delivery does not freshen an already captured completion draft", async () => {
  const h = harness(), completing = h.tab(), editing = h.tab();
  const displayed = structuredClone(seedVisit);
  const latest = { ...seedVisit, notes: "New notes before confirm" };
  await saveDraft(h, editing, latest);
  completing.sync();
  const attempt = h.finish(completing, displayed);
  await h.locks.releaseNext();
  await attempt.done;
  assertRejected(h, attempt, displayed);
  assert.equal(JSON.parse(h.values.get(draftKey)).notes, latest.notes);
});

for (const failure of ["read", "write", "memoryOnly", "missingLock", "rejectedLock"]) {
  test(`${failure}: unsuccessful completion preserves edits and never reports success`, async () => {
    const h = harness(), tab = h.tab();
    let displayed = structuredClone(seedVisit);
    if (failure === "memoryOnly") {
      tab.faults.write = true;
      displayed = { ...seedVisit, notes: "My disconnected notes" };
      await saveDraft(h, tab, displayed);
      tab.faults.write = false;
    } else if (failure === "missingLock") {
      h.removeLocks();
    } else if (failure === "rejectedLock") {
      h.locks.request = () => Promise.reject(new Error("Synthetic lock rejection"));
    }
    const before = [...h.values];
    const attempt = h.finish(tab, displayed);
    if (failure === "read" || failure === "write") tab.faults[failure] = true;
    if (h.pending.length) await h.locks.releaseNext();
    await attempt.done;
    assert.deepEqual([...h.values], before);
    assertRejected(h, attempt, displayed);
    if (failure === "memoryOnly") assert.deepEqual(tab.store.read().queue[0].visit, displayed);
  });
}

test("matching completion persists the reviewed draft and appends history exactly once", async () => {
  const h = harness(), tab = h.tab();
  await saveDraft(h, tab, seedVisit);
  const attempt = h.finish(tab);
  await h.locks.releaseNext();
  await attempt.done;
  const completed = h.persisted();
  assert.equal(completed.queue[0].status, "completed");
  assert.deepEqual({ ...completed.queue[0].visit, completedAt: undefined }, { ...seedVisit, completedAt: undefined });
  assert.equal(completed.patients[0].visits.length, 1);
  assert.equal(attempt.ui.error, "");
  assert.equal(attempt.ui.reviewClosed, true);
  assert.equal(attempt.ui.navigations.length, 1);
  const retry = h.finish(tab);
  await h.locks.releaseNext();
  await retry.done;
  assert.deepEqual(h.persisted(), completed);
  assert.deepEqual(retry.ui.navigations, []);
  assert.match(retry.ui.error, /لم تعد الزيارة/);
});

test("an appointment crossing midnight while completion waits is revalidated", async () => {
  const h = harness(), tab = h.tab();
  const attempt = h.finish(tab);
  h.midnight();
  await h.locks.releaseNext();
  await attempt.done;
  assertRejected(h, attempt, seedVisit);
});

test("the final boundary rejects an incomplete diet without losing the draft", async () => {
  const h = harness(), tab = h.tab();
  const invalid = { ...seedVisit, days: [] };
  await saveDraft(h, tab, invalid);
  const attempt = h.finish(tab, invalid);
  await h.locks.releaseNext();
  await attempt.done;
  assertRejected(h, attempt, invalid);
});

test("same-tab autosave queued after completion stays recoverable without changing the completed record", async () => {
  const h = harness(), tab = h.tab();
  const attempt = h.finish(tab);
  const latest = { ...seedVisit, notes: "Edited while waiting for lock" };
  const saving = tab.store.saveVisit("fictional-entry", () => latest, seedVisit);
  await h.locks.releaseNext();
  await attempt.done;
  await h.locks.releaseNext();
  assert.equal(await saving, "unavailable");
  assert.equal(h.persisted().queue[0].status, "completed");
  assert.equal(attempt.ui.navigations.length, 1);
  assert.deepEqual(tab.store.localDraft("fictional-entry"), latest);
  assert.equal(tab.store.read().queue[0].visit.notes, seedVisit.notes);
  assert.equal(h.values.has(draftKey), false);
});

test("two queued completion attempts append one history record and only one reports success", async () => {
  const h = harness(), first = h.tab(), second = h.tab();
  const winner = h.finish(first), loser = h.finish(second);
  assert.equal(h.pending.length, 2);
  await h.locks.releaseNext();
  await winner.done;
  const completed = h.persisted();
  await h.locks.releaseNext();
  await loser.done;
  assert.deepEqual(h.persisted(), completed);
  assert.equal(completed.patients[0].visits.length, 1);
  assert.equal(winner.ui.navigations.length, 1);
  assert.deepEqual(loser.ui.navigations, []);
  assert.match(loser.ui.error, /لم تعد الزيارة/);
  assert.deepEqual(loser.ui.recovery, seedVisit);
});
