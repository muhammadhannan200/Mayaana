import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  formatInventory,
  inventorySources,
  readSources,
} from "./architecture-inventory.mjs";

const inspect = (files) => inventorySources(new Map(Object.entries(files)));

test("detects the retained clinic-flow runtime cycle, but not a type-only back edge", () => {
  const flow = "frontend/secretary/clinic-flow.tsx";
  const persisted = "frontend/secretary/persisted-flow.tsx";
  const result = inspect({
    [flow]: 'import { PersistedFlow } from "./persisted-flow";',
    [persisted]: 'import { ClinicFlowView } from "./clinic-flow";',
  });
  assert.deepEqual(result.cycles[0].path, [flow, persisted, flow]);
  assert.match(formatInventory(result), /Report only/);
  assert.equal(
    inspect({
      [flow]: 'import { PersistedFlow } from "./persisted-flow";',
      [persisted]: 'import { type ClinicFlowView } from "./clinic-flow";',
    }).cycles.length,
    0
  );
});

test("recognizes re-exports, literal lazy/require edges, self-cycles and import types", () => {
  const result = inspect({
    "lib/a.ts": 'export { b } from "./b"; export type { Shape } from "./c";',
    "lib/b.ts": 'const a = import("./a"); const self = require("./b");',
    "lib/c.ts": 'type A = import("./a").A;',
    "lib/self.ts": 'import "./self";',
  });
  assert.equal(result.cycles.length, 2);
  assert.deepEqual(result.cycles[0].members, ["lib/a.ts", "lib/b.ts"]);
  assert.deepEqual(result.cycles[1].path, ["lib/self.ts", "lib/self.ts"]);
});

test("reports production Demo contracts, route dependencies and clinical React dependencies", () => {
  const result = inspect({
    "shared/clinical-types.ts":
      'import type { DemoVisit as Visit } from "../frontend/demo/demo-clinic"; import type { MockVisit } from "@/frontend/secretary/measurements/mock-visits"; import type { ReactNode } from "react";',
    "frontend/demo/demo-clinic.tsx": "export type DemoVisit = {};",
    "frontend/secretary/measurements/mock-visits.ts":
      "export type MockVisit = {};",
  });
  assert.equal(
    result.findings.filter((item) => item.kind === "production-demo").length,
    2
  );
  assert.equal(
    result.findings.filter((item) => item.kind === "lib-route").length,
    1
  );
  assert.equal(
    result.findings.filter((item) => item.kind === "model-dependency").length,
    2
  );
  assert.equal(
    result.findings.some(
      (item) => item.path === "frontend/demo/demo-clinic.tsx"
    ),
    false
  );
});

test("reports shared UI/server imports and Doctor-to-Secretary ownership", () => {
  const result = inspect({
    "components/ui/card.tsx":
      'import { read } from "@/lib/data"; import { save } from "@/backend/actions/clinical-actions"; import type { SupabaseClient } from "@supabase/supabase-js";',
    "lib/data.ts": 'import "server-only";',
    "backend/actions/clinical-actions.ts":
      '"use server"; export async function save() {}',
    "app/doctor/page.tsx":
      'import { ClinicFlow } from "@/frontend/secretary/clinic-flow";',
    "frontend/secretary/clinic-flow.tsx":
      "export const ClinicFlow = () => null;",
  });
  assert.equal(
    result.findings.filter((item) => item.kind === "shared-ui-server").length,
    3
  );
  assert.equal(
    result.findings.filter((item) => item.kind === "cross-role").length,
    1
  );
});

test("does not mistake comments or strings for imports; reports size signals without failing", () => {
  const result = inspect({
    "lib/large.ts":
      '// import x from "react"\nconst description = \'import x from "./large"\';\n' +
      "// line\n".repeat(400),
  });
  assert.equal(result.cycles.length, 0);
  assert.equal(result.modules[0].imports.length, 0);
  assert.equal(result.findings[0].kind, "responsibility-signal");
});

test("scans only owned source trees, excluding environment, generated, SQL and dependency files", () => {
  const tempBase =
    process.platform === "win32"
      ? join(process.env.LOCALAPPDATA, "Temp", "opencode")
      : tmpdir();
  const root = mkdtempSync(join(tempBase, "architecture-inventory-test-"));
  try {
    for (const directory of ["app", "lib", "node_modules", ".next", "supabase"])
      mkdirSync(join(root, directory));
    for (const path of [
      "app/page.tsx",
      "lib/types.ts",
      "proxy.ts",
      "node_modules/fake.ts",
      ".next/generated.ts",
      "supabase/schema.sql",
      ".env.local",
    ])
      writeFileSync(join(root, path), "// synthetic scanner fixture\n");
    assert.deepEqual(
      [...readSources(root).keys()],
      ["app/page.tsx", "lib/types.ts", "proxy.ts"]
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
