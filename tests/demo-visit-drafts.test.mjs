import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { handoffQueue } from "../lib/queue-handoff.ts";

const source = ts.createSourceFile(
  "lib/demo-clinic.tsx",
  readFileSync("lib/demo-clinic.tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true
);
const declaration = source.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "createStore"
);
assert.ok(declaration);
const { outputText } = ts.transpileModule(declaration.getText(source), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
});
const visit = (notes) => ({ notes, days: [], appointment: "2026-11-15" });
const key = "mayanaa-demo-v1:public";
const draftKey = "mayanaa-demo-visit-v1:public:fictional-entry";

function harness() {
  const initial = {
    patients: [{ id: "fictional-patient", name: "Synthetic", visits: [] }],
    queue: [{
      id: "fictional-entry", patientId: "fictional-patient", kind: "follow_up",
      status: "with_doctor", measurements: { weight: "80" }, visit: visit("Seed"),
    }],
  };
  const values = new Map([[key, JSON.stringify(initial)]]);
  function tab() {
    const listeners = new Set();
    const faults = { read: false, write: false, lock: false };
    const writes = [];
    const createStore = new Function(
      "initial", "handoffQueue", "navigator", "localStorage", "window",
      `${outputText}\nreturn createStore;`
    )(
      structuredClone(initial), handoffQueue,
      { locks: { request: async (_name, callback) => {
        if (faults.lock) throw new Error("Synthetic lock rejection");
        return callback();
      } } },
      {
        getItem(name) {
          if (faults.read) throw new Error("Synthetic read failure");
          return values.get(name) ?? null;
        },
        setItem(name, value) {
          if (faults.write) throw new Error("Synthetic write failure");
          writes.push(name);
          values.set(name, value);
        },
        removeItem: (name) => values.delete(name),
        // Reset enumerates own storage keys in the browser.
        [draftKey]: "",
      },
      {
        addEventListener: (_name, listener) => listeners.add(listener),
        removeEventListener: (_name, listener) => listeners.delete(listener),
      }
    );
    const store = createStore("public");
    store.read();
    store.subscribe(() => {});
    return {
      store, faults, writes,
      sync: (name = draftKey) => listeners.forEach((listener) => listener({ key: name })),
    };
  }
  return { tab, values };
}

const entryVisit = (tab) => structuredClone(tab.store.read().queue[0].visit);
function save(tab, notes, expected = entryVisit(tab)) {
  return tab.store.saveVisit("fictional-entry", (current) => ({ ...current, notes }), expected);
}

for (const failure of ["read", "write", "lock"]) {
  test(`${failure} failure: recovery cannot publish a disconnected same-visit draft`, async () => {
    const h = harness(), stale = h.tab(), other = h.tab();
    stale.faults[failure] = true;
    if (failure === "lock") await stale.store.update((state) => ({ ...state }));
    else await save(stale, "Offline first edit");
    await save(other, "New authoritative draft");
    const authoritative = h.values.get(draftKey);
    assert.equal(JSON.parse(authoritative).notes, "New authoritative draft");
    stale.faults[failure] = false;
    stale.sync();
    const writeCount = stale.writes.length;
    const outcome = await save(stale, "Still disconnected");
    assert.equal(h.values.get(draftKey), authoritative, "Disconnected tab must not overwrite the newer same-visit draft");
    assert.equal(stale.writes.length, writeCount, "No shared-storage write after isolation");
    assert.equal(entryVisit(stale).notes, "Still disconnected", "Keep the attempted edit locally");
    assert.equal(outcome, "local_only");
    assert.equal(entryVisit(h.tab()).notes, "New authoritative draft", "Reload recovers authority, not stale edits");
  });
}

test("a stale editor detects a newer authoritative same-visit draft before autosave", async () => {
  const h = harness(), stale = h.tab(), other = h.tab();
  const rendered = entryVisit(stale);
  await save(other, "Authoritative edit");
  const authoritative = h.values.get(draftKey);
  // Delivering storage events cannot make an already-created editor callback fresh.
  stale.sync();
  const outcome = await save(stale, "Unsaved conflicting edit", rendered);
  assert.equal(h.values.get(draftKey), authoritative);
  assert.equal(outcome, "conflict");
  assert.equal(entryVisit(stale).notes, "Unsaved conflicting edit");
  await save(other, "Even newer edit");
  stale.sync();
  assert.equal(await save(stale, "Local continuation"), "local_only");
  assert.equal(JSON.parse(h.values.get(draftKey)).notes, "Even newer edit");
});

test("delayed storage events do not permit a stale same-visit overwrite", async () => {
  const h = harness(), stale = h.tab(), other = h.tab();
  const rendered = entryVisit(stale);
  await save(other, "Newer before event delivery");
  const authoritative = h.values.get(draftKey);
  assert.equal(await save(stale, "Stale input", rendered), "conflict");
  assert.equal(h.values.get(draftKey), authoritative);
});

test("confirmed connected autosave remains reloadable and synchronized without format changes", async () => {
  const h = harness(), first = h.tab(), second = h.tab();
  assert.equal(await save(first, "First edit"), "saved");
  assert.deepEqual(JSON.parse(h.values.get(draftKey)), visit("First edit"));
  second.sync();
  assert.deepEqual(entryVisit(second), visit("First edit"));
  assert.equal(await save(second, "Second edit"), "saved");
  first.sync();
  assert.deepEqual(entryVisit(first), visit("Second edit"));
  assert.deepEqual(entryVisit(h.tab()), visit("Second edit"));
  assert.deepEqual(Object.keys(JSON.parse(h.values.get(key))), ["patients", "queue"]);
});

test("connected reset clears shared draft keys; isolated reset must not clear them", async () => {
  const h = harness(), isolated = h.tab(), connected = h.tab();
  isolated.faults.lock = true;
  await isolated.store.update((state) => ({ ...state }));
  await save(connected, "Keep authoritative draft");
  const authoritative = h.values.get(draftKey);
  await isolated.store.reset();
  assert.equal(h.values.get(draftKey), authoritative);
  await connected.store.reset();
  assert.equal(h.values.has(draftKey), false);
  assert.deepEqual(entryVisit(h.tab()), visit("Seed"));
});

test("draft autosave never writes into a completed visit", async () => {
  const h = harness(), stale = h.tab(), other = h.tab();
  const rendered = entryVisit(stale);
  await other.store.update((state) => ({
    ...state, queue: state.queue.map((entry) => ({ ...entry, status: "completed" })),
  }));
  const before = [...h.values];
  assert.equal(await save(stale, "Too late", rendered), "unavailable");
  assert.deepEqual([...h.values], before);
});

test("the actual Demo editor passes its displayed base and announces conflicts/local-only saves", async () => {
  const editor = ts.createSourceFile(
    "app/doctor/visit-screen.tsx",
    readFileSync("app/doctor/visit-screen.tsx", "utf8"),
    ts.ScriptTarget.Latest,
    true
  );
  function findSave(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "save") return node;
    return ts.forEachChild(node, findSave);
  }
  const saveFunction = findSave(editor);
  assert.ok(saveFunction);
  const compiled = ts.transpileModule(saveFunction.getText(editor), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const h = harness(), stale = h.tab(), other = h.tab();
  const rendered = entryVisit(stale);
  await save(other, "New authoritative draft");
  const authoritative = h.values.get(draftKey);
  async function edit(tab, displayed, notes) {
    let message;
    await new Function("operations", "local", "entryId", "visit", "setError", "setFailedCompletionDraft",
      `${compiled}\nreturn save;`
    )(undefined, tab.store, "fictional-entry", displayed, (error) => { message = error; }, () => {})(
      (current) => ({ ...current, notes })
    );
    return message;
  }
  assert.match(await edit(stale, rendered, "Conflicting input"), /تغيّرت المسودة في تبويب آخر/);
  assert.equal(h.values.get(draftKey), authoritative);
  assert.match(await edit(stale, entryVisit(stale), "Local-only input"), /ذاكرة هذا التبويب فقط/);
  assert.equal(h.values.get(draftKey), authoritative);
  assert.equal(await edit(other, entryVisit(other), "Normal saved input"), "");
});
