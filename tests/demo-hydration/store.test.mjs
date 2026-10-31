import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const requireNative = createRequire(import.meta.url);
const cleanups = [];

// Compile the real public fixture/store modules in memory; no emitted files,
// private-member probes, replacement application logic or new dependencies.
function modules() {
  const cache = new Map();
  function load(file) {
    if (!path.extname(file)) file += ".ts";
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const localRequire = (id) => {
      if (id.startsWith(".")) return load(path.resolve(path.dirname(file), id));
      if (id.startsWith("@/")) return load(path.resolve(id.slice(2)));
      return requireNative(id);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, {
      filename: file,
    })(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return {
    fixture: load(path.resolve("lib/demo-fixture.ts")),
    store: load(path.resolve("lib/demo-store.ts")),
  };
}

beforeEach(() => {
  global.document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  delete global.window;
  delete global.localStorage;
  delete global.document;
});

for (const [today, previous, next] of [
  ["2024-02-28", "2024-02-14", "2024-03-13"],
  ["2024-02-29", "2024-02-15", "2024-03-14"],
  ["2024-03-01", "2024-02-16", "2024-03-15"],
  ["2023-03-01", "2023-02-15", "2023-03-15"],
  ["2025-01-01", "2024-12-18", "2025-01-15"],
  ["2024-04-01", "2024-03-18", "2024-04-15"],
]) {
  test(`explicit calendar fixture ${today} is independent of timezone and wall clock`, () => {
    const { createDemoFixture, shiftDemoDate } = modules().fixture;
    const fixture = createDemoFixture(today);
    assert.equal(
      fixture.patients.find((p) => p.id === "demo-noor").visits[0].date,
      previous
    );
    assert.equal(
      fixture.patients.find((p) => p.id === "demo-maryam").visits[0].date,
      today
    );
    assert.equal(
      fixture.queue.find((e) => e.id === "demo-featured").visit.appointment,
      next
    );
    assert.equal(shiftDemoDate(today, -14), previous);
    assert.equal(shiftDemoDate(today, 14), next);
    fixture.patients[0].visits[0].measurements.weight = "999";
    assert.equal(
      createDemoFixture(today).patients[0].visits[0].measurements.weight,
      "65.8"
    );
  });
}

test("server/hydration snapshots are immutable, clock-independent and referentially stable", (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2024-02-28T23:59:59Z").getTime(),
  });
  const first = modules().store.createDemoStore("public");
  const initial = first.server();
  assert.strictEqual(first.server(), initial);
  assert.strictEqual(first.read(), initial);
  assert.ok(Object.isFrozen(initial));
  assert.ok(Object.isFrozen(initial.patients[0].visits[0].measurements));
  t.mock.timers.setTime(new Date("2025-01-01T00:00:01Z").getTime());
  const second = modules().store.createDemoStore("public");
  assert.deepEqual(second.server(), initial);
  assert.strictEqual(first.server(), initial);
  assert.strictEqual(first.read(), initial);
});

test("browser snapshots cache local fixtures, preserve saved data and never mutate the bootstrap", () => {
  const values = new Map();
  global.window = new EventTarget();
  global.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const { createDemoStore } = modules().store;
  const store = createDemoStore("public");
  const initial = store.server();
  const browser = store.read();
  assert.notStrictEqual(browser, initial);
  assert.strictEqual(store.read(), browser);
  const changed = "مريض خيالي محفوظ";
  store.update((state) => ({
    ...state,
    patients: state.patients.map((p, i) => (i ? p : { ...p, name: changed })),
  }));
  const saved = store.read();
  assert.strictEqual(store.read(), saved);
  assert.equal(saved.patients[0].name, changed);
  assert.notEqual(initial.patients[0].name, changed);
  assert.strictEqual(store.server(), initial);
  assert.deepEqual(
    Object.keys(JSON.parse(values.get("mayanaa-demo-v1:public"))).sort(),
    ["patients", "queue"]
  );
  const reloaded = createDemoStore("public");
  assert.equal(reloaded.read().patients[0].name, changed);
  assert.strictEqual(reloaded.read(), reloaded.read());
  store.reset();
  assert.equal(store.read().patients[0].name, browser.patients[0].name);
  assert.strictEqual(store.read(), browser);
});

test("unavailable storage retains notes in memory, supports reset and stable snapshots", () => {
  global.window = new EventTarget();
  global.localStorage = {
    getItem() {
      throw new Error("Synthetic storage unavailable");
    },
    setItem() {
      throw new Error("Synthetic storage unavailable");
    },
  };
  const store = modules().store.createDemoStore("public");
  const initial = store.read();
  store.update((state) => ({
    ...state,
    queue: state.queue.map((entry) =>
      entry.id === "demo-featured"
        ? {
            ...entry,
            visit: { ...entry.visit, notes: "ملاحظة خيالية في الذاكرة" },
          }
        : entry
    ),
  }));
  const saved = store.read();
  assert.strictEqual(store.read(), saved);
  assert.equal(
    saved.queue.find((entry) => entry.id === "demo-featured").visit.notes,
    "ملاحظة خيالية في الذاكرة"
  );
  store.reset();
  assert.strictEqual(store.read(), initial);
  assert.notEqual(
    initial.queue.find((entry) => entry.id === "demo-featured").visit.notes,
    "ملاحظة خيالية في الذاكرة"
  );
});

test("storage synchronization ignores other scopes, handles clearing and unsubscribes", () => {
  const values = new Map();
  global.window = new EventTarget();
  global.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const store = modules().store.createDemoStore("public");
  const initial = store.read();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  function storage(key) {
    const event = new Event("storage");
    Object.defineProperty(event, "key", { value: key });
    window.dispatchEvent(event);
  }
  const saved = structuredClone(initial);
  saved.patients[0].name = "تعديل خيالي من تبويب آخر";
  values.set("mayanaa-demo-v1:public", JSON.stringify(saved));
  storage("mayanaa-demo-v1:other");
  assert.strictEqual(store.read(), initial);
  assert.equal(notifications, 0);
  storage("mayanaa-demo-v1:public");
  assert.equal(store.read().patients[0].name, saved.patients[0].name);
  assert.strictEqual(store.read(), store.read());
  assert.equal(notifications, 1);
  values.clear();
  storage(null);
  assert.strictEqual(store.read(), initial);
  assert.equal(notifications, 2);
  unsubscribe();
  storage(null);
  assert.equal(notifications, 2);
});

test("calendar reads advance across midnight without replacing fixtures or writing storage", (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2024-02-29T23:59:59").getTime(),
  });
  global.window = new EventTarget();
  let writes = 0;
  global.localStorage = { getItem: () => null, setItem: () => writes++ };
  const store = modules().store.createDemoStore("public");
  const before = store.read();
  const server = store.server();
  t.mock.timers.setTime(new Date("2024-03-01T00:00:01").getTime());
  const after = store.read();
  assert.equal(after.today, "2024-03-01");
  assert.strictEqual(after.patients, before.patients);
  assert.strictEqual(after.queue, before.queue);
  assert.strictEqual(store.read(), after);
  assert.strictEqual(store.server(), server);
  assert.equal(writes, 0);
  store.reset();
  assert.equal(store.read().today, "2024-03-01");
  assert.strictEqual(store.read().patients, before.patients);
  assert.strictEqual(store.read().queue, before.queue);
});

test("subscribed calendar ticks at local midnight, preserves saved dates and stops after unsubscribe", (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: new Date("2024-02-29T23:59:59").getTime(),
  });
  global.window = new EventTarget();
  let writes = 0;
  const {
    fixture,
    store: { createDemoStore },
  } = modules();
  const saved = fixture.createDemoFixture("2024-02-29");
  saved.queue.find((entry) => entry.id === "demo-featured").visit.appointment =
    "2024-03-10";
  global.localStorage = {
    getItem: () => JSON.stringify(saved),
    setItem: () => writes++,
  };
  const store = createDemoStore("public");
  const before = store.read();
  const snapshots = [];
  const unsubscribe = store.subscribe(() => snapshots.push(store.read()));
  cleanups.push(unsubscribe);
  t.mock.timers.tick(2000);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].today, "2024-03-01");
  assert.strictEqual(snapshots[0].patients, before.patients);
  assert.strictEqual(snapshots[0].queue, before.queue);
  assert.equal(
    snapshots[0].queue.find((entry) => entry.id === "demo-featured").visit
      .appointment,
    "2024-03-10"
  );
  assert.equal(writes, 0);
  unsubscribe();
  t.mock.timers.tick(86400000);
  window.dispatchEvent(new Event("focus"));
  assert.equal(snapshots.length, 1);
});

test("focus, visible resume and pageshow catch missed midnights without reseeding", (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: new Date("2024-12-31T23:59:59").getTime(),
  });
  global.window = new EventTarget();
  global.localStorage = {
    getItem: () => null,
    setItem: () => assert.fail("calendar must not persist"),
  };
  const store = modules().store.createDemoStore("public");
  const before = store.read();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  cleanups.push(unsubscribe);
  t.mock.timers.setTime(new Date("2025-01-01T08:00:00").getTime());
  window.dispatchEvent(new Event("focus"));
  assert.equal(notifications, 1);
  assert.equal(store.read().today, "2025-01-01");
  window.dispatchEvent(new Event("focus"));
  assert.equal(notifications, 1);
  document.visibilityState = "hidden";
  t.mock.timers.setTime(new Date("2025-01-02T08:00:00").getTime());
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(notifications, 1);
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(notifications, 2);
  assert.equal(store.read().today, "2025-01-02");
  t.mock.timers.setTime(new Date("2025-01-03T08:00:00").getTime());
  window.dispatchEvent(new Event("pageshow"));
  assert.equal(notifications, 3);
  assert.equal(store.read().today, "2025-01-03");
  assert.strictEqual(store.read().patients, before.patients);
  assert.strictEqual(store.read().queue, before.queue);
});

test("multiple subscribers share calendar notifications and action-time reads catch suspended clocks", (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: new Date("2024-02-29T23:59:59").getTime(),
  });
  global.window = new EventTarget();
  global.localStorage = {
    getItem: () => null,
    setItem: () => assert.fail("calendar must not persist"),
  };
  const store = modules().store.createDemoStore("public");
  const before = store.read();
  let first = 0;
  let second = 0;
  const offFirst = store.subscribe(() => first++);
  const offSecond = store.subscribe(() => second++);
  cleanups.push(offFirst, offSecond);
  t.mock.timers.tick(2000);
  assert.equal(first, 1);
  assert.equal(second, 1);
  offFirst();
  // No timer or resume event is delivered after this wall-clock jump.
  t.mock.timers.setTime(new Date("2024-03-02T08:00:00").getTime());
  // A render can read the new date before a delayed timer gets to publish it.
  assert.equal(store.read().today, "2024-03-02");
  assert.equal(store.currentDate(), "2024-03-02");
  assert.equal(first, 1);
  assert.equal(second, 2);
  assert.strictEqual(store.read().patients, before.patients);
  assert.strictEqual(store.read().queue, before.queue);
  store.currentDate();
  assert.equal(second, 2);
});

for (const [start, next] of [
  ["2024-03-10", "2024-03-11"],
  ["2024-11-03", "2024-11-04"],
]) {
  test(`local midnight scheduler respects the calendar boundary ${start} to ${next}`, (t) => {
    const now = new Date(`${start}T00:00:00`).getTime();
    const boundary = new Date(`${next}T00:00:00`).getTime();
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now });
    global.window = new EventTarget();
    global.localStorage = {
      getItem: () => null,
      setItem: () => assert.fail("calendar must not persist"),
    };
    const store = modules().store.createDemoStore("public");
    store.read();
    const dates = [];
    cleanups.push(store.subscribe(() => dates.push(store.read().today)));
    t.mock.timers.tick(boundary - now - 1);
    assert.deepEqual(dates, []);
    t.mock.timers.tick(1);
    assert.deepEqual(dates, [next]);
  });
}
