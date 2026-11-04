import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { handoffQueue } from "../lib/queue-handoff.ts";

const source = ts.createSourceFile("lib/demo-clinic.tsx", readFileSync("lib/demo-clinic.tsx", "utf8"), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "createStore");
assert.ok(declaration);
const compiled = ts.transpileModule(declaration.getText(source), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const key = "mayanaa-demo-v1:public";
const draftPrefix = "mayanaa-demo-visit-v1:public:";
const draftKey = `${draftPrefix}entry`;
const firstDraftKey = `${draftPrefix}older-entry`;
const visit = (notes) => ({ notes, days: [], appointment: "" });

function harness() {
  const initial = {
    patients: [{ id: "patient", name: "Seed patient", visits: [] }],
    queue: [{ id: "entry", patientId: "patient", kind: "follow_up", status: "with_doctor", measurements: { weight: "80" }, visit: visit("Seed visit") }],
  };
  const committed = structuredClone(initial);
  committed.patients[0].name = "Existing fictional patient";
  committed.queue[0].visit = visit("Existing fictional visit");
  const values = new Map([
    [key, JSON.stringify(committed)],
    [firstDraftKey, JSON.stringify(visit("Older draft"))],
    [draftKey, JSON.stringify(visit("Surviving draft"))],
    ["unrelated-preference", "keep"],
    ["mayanaa-demo-visit-v1:other:entry", "keep other scope"],
  ]);
  const writes = [], removals = [];
  let held = false;
  const locks = { request: async (_name, callback) => {
    assert.equal(held, false, "Shared operations must serialize");
    held = true;
    try { return callback(); }
    finally { held = false; }
  } };
  function tab(faults = {}) {
    const listeners = new Set();
    const storage = new Proxy({
      getItem: (name) => values.get(name) ?? null,
      setItem(name, value) {
        assert.equal(held, true);
        if (faults.write) throw new Error("Synthetic main-document write failure");
        writes.push(name);
        values.set(name, value);
      },
      removeItem(name) {
        assert.equal(held, true);
        if (faults.remove && name === draftKey) throw new Error("Synthetic draft deletion failure");
        removals.push(name);
        values.delete(name);
      },
    }, {
      ownKeys() {
        if (faults.enumerate) throw new Error("Synthetic draft enumeration failure");
        return [...values.keys()];
      },
      getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
    });
    const createStore = new Function("initial", "handoffQueue", "navigator", "localStorage", "window", `${compiled}\nreturn createStore;`)(
      structuredClone(initial), handoffQueue,
      { locks: { request: (...args) => faults.lock ? Promise.reject(new Error("Synthetic lock failure")) : locks.request(...args) } },
      storage,
      { addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn) }
    );
    const store = createStore("public");
    store.read();
    store.subscribe(() => {});
    return { store, sync: () => listeners.forEach((fn) => fn({ key })) };
  }
  return { tab, values, writes, removals, initial, committed };
}

for (const failure of ["enumerate", "remove"]) {
  test(`${failure} failure: reset cannot publish a fresh seed or resume shared writes`, async () => {
    const h = harness(), faults = { [failure]: true }, isolated = h.tab(faults);
    const before = h.values.get(key);
    const outcome = await isolated.store.reset();
    assert.equal(h.values.get(key), before, "Failed cleanup must not reset the shared main document");
    assert.equal(outcome, "local_only", "Do not acknowledge a fully persisted reset");
    assert.deepEqual(isolated.store.read(), h.initial, "The local-only reset must not overlay surviving drafts");
    assert.equal(h.values.has(draftKey), true);
    if (failure === "remove") assert.equal(h.values.has(firstDraftKey), false, "Exercise failure after partial cleanup");
    faults[failure] = false;
    const other = h.tab();
    await other.store.update((state) => ({ ...state, patients: state.patients.map((patient) => ({ ...patient, name: "New authoritative edit" })) }));
    const authoritative = [...h.values], writes = h.writes.length;
    isolated.sync();
    await isolated.store.update((state) => ({ ...state, patients: [] }));
    assert.equal(await isolated.store.reset(), "local_only");
    assert.deepEqual([...h.values], authoritative, "Recovery and retries must never flush the disconnected reset");
    assert.equal(h.writes.length, writes);
    assert.equal(await h.tab().store.reset(), "reset", "A fresh connected store may explicitly retry cleanup");
    assert.equal(h.values.has(draftKey), false);
    assert.deepEqual(h.tab().store.read(), h.initial);
  });

  test(`${failure} failure: reload and cross-tab initialization cannot attach the survivor to reset seed data`, async () => {
    const h = harness(), faults = { [failure]: true }, tab = h.tab(faults);
    await tab.store.reset();
    faults[failure] = false;
    for (const fresh of [h.tab(), h.tab()]) {
      const state = fresh.store.read();
      assert.equal(state.patients[0].name, h.committed.patients[0].name, "The original shared dataset, not reset seed data, must remain authoritative");
      assert.equal(state.queue[0].visit.notes, "Surviving draft");
      assert.equal(h.values.get("unrelated-preference"), "keep");
      assert.equal(h.values.get("mayanaa-demo-visit-v1:other:entry"), "keep other scope");
    }
  });
}

test("successful reset clears only scoped drafts and synchronizes existing and fresh tabs", async () => {
  const h = harness(), resetting = h.tab(), other = h.tab();
  assert.equal(await resetting.store.reset(), "reset");
  assert.deepEqual(JSON.parse(h.values.get(key)), h.initial);
  assert.deepEqual(h.removals, [firstDraftKey, draftKey]);
  assert.equal(h.values.get("unrelated-preference"), "keep");
  assert.equal(h.values.get("mayanaa-demo-visit-v1:other:entry"), "keep other scope");
  other.sync();
  for (const tab of [resetting, other, h.tab()]) assert.deepEqual(tab.store.read(), h.initial);
  assert.deepEqual(Object.keys(JSON.parse(h.values.get(key))), ["patients", "queue"]);
});

test("main-document write failure cannot acknowledge a successful reset", async () => {
  const h = harness(), faults = { write: true }, tab = h.tab(faults);
  const before = h.values.get(key);
  assert.equal(await tab.store.reset(), "local_only");
  assert.equal(h.values.get(key), before);
  faults.write = false;
  await tab.store.update((state) => ({ ...state }));
  assert.equal(h.values.get(key), before);
  assert.deepEqual(tab.store.read(), h.initial);
});

test("already isolated reset never enumerates or removes shared drafts", async () => {
  const h = harness(), faults = { lock: true, enumerate: true, remove: true }, tab = h.tab(faults);
  await tab.store.update((state) => ({ ...state }));
  const before = [...h.values];
  assert.equal(await tab.store.reset(), "local_only");
  assert.deepEqual([...h.values], before);
  assert.deepEqual(h.removals, []);
  assert.deepEqual(tab.store.read(), h.initial);
});
