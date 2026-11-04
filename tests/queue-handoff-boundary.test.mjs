import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

test("shared queue handoff contract has no transitive Demo, route, React or persistence imports", () => {
  const visited = new Set();
  function inspect(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const text = readFileSync(file, "utf8");
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true
    );
    function visit(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const name = node.moduleSpecifier.text;
        assert.ok(
          name.startsWith("."),
          `Neutral queue contract cannot import ${name}`
        );
        const target = resolve(
          dirname(file),
          name.replace(/\.ts$/, "") + ".ts"
        );
        assert.doesNotMatch(
          target,
          /[\\/](app|demo[^\\/]*|clinical[^\\/]*|supabase)[\\/\.]/i
        );
        inspect(target);
      }
      if (ts.isIdentifier(node)) assert.doesNotMatch(node.text, /^Demo/);
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.doesNotMatch(text, /\b(localStorage|navigator|window)\b/);
  }
  inspect(resolve("lib/queue-handoff.ts"));
});
