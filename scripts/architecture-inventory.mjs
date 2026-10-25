import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const slash = (path) => path.replaceAll("\\", "/");
const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts"];

// Only source trees owned by this checkout; never scan adjacent worktrees,
// generated output, dependencies, environment files or arbitrary symlinks.
export function readSources(root) {
  const sources = new Map();
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (extensions.includes(extname(path)))
        sources.set(slash(relative(root, path)), readFileSync(path, "utf8"));
    }
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (
      entry.isDirectory() &&
      ["app", "lib", "components", "features", "tests"].includes(entry.name)
    )
      visit(join(root, entry.name));
    else if (entry.isFile() && entry.name === "proxy.ts")
      sources.set(entry.name, readFileSync(join(root, entry.name), "utf8"));
  }
  return new Map([...sources].sort(([a], [b]) => a.localeCompare(b)));
}

function resolveLocal(from, specifier, sources) {
  const base = specifier.startsWith("@/")
    ? specifier.slice(2)
    : specifier.startsWith(".")
      ? posix.normalize(posix.join(posix.dirname(from), specifier))
      : undefined;
  if (!base) return undefined;
  return [
    base,
    ...extensions.map((ext) => base + ext),
    ...extensions.map((ext) => base + "/index" + ext),
  ].find((candidate) => sources.has(candidate));
}

function importsAndMetrics(path, source) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const imports = [];
  const metrics = { functions: 0, stateHooks: 0, jsxElements: 0 };
  const add = (node, specifier, runtime, names = []) =>
    imports.push({
      specifier,
      runtime,
      names,
      line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
    });
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const named =
        bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
      const runtime =
        !clause ||
        (!clause.isTypeOnly &&
          (!!clause.name ||
            !bindings ||
            ts.isNamespaceImport(bindings) ||
            named.length === 0 ||
            named.some((item) => !item.isTypeOnly)));
      add(
        node,
        node.moduleSpecifier.text,
        runtime,
        named.map((item) => (item.propertyName ?? item.name).text)
      );
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const named =
        node.exportClause && ts.isNamedExports(node.exportClause)
          ? node.exportClause.elements
          : [];
      add(
        node,
        node.moduleSpecifier.text,
        !node.isTypeOnly &&
          (!node.exportClause ||
            ts.isNamespaceExport(node.exportClause) ||
            named.length === 0 ||
            named.some((item) => !item.isTypeOnly)),
        named.map((item) => (item.propertyName ?? item.name).text)
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      add(node, node.moduleReference.expression.text, !node.isTypeOnly);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      add(
        node,
        node.argument.literal.text,
        false,
        node.qualifier ? [node.qualifier.getText(file)] : []
      );
    } else if (ts.isCallExpression(node)) {
      if (
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === "require")) &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      )
        add(node, node.arguments[0].text, true);
      if (
        /^(useState|useReducer|useEffect|useSyncExternalStore)$/.test(
          node.expression.getText(file)
        )
      )
        metrics.stateHooks++;
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    )
      metrics.functions++;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      metrics.jsxElements++;
    ts.forEachChild(node, visit);
  }
  visit(file);
  return { imports, metrics };
}

function runtimeCycles(graph) {
  // One deterministic witness per strongly connected group, not every possible
  // cycle (which can grow exponentially). Type-only edges are excluded.
  let index = 0;
  const indices = new Map(),
    low = new Map(),
    stack = [],
    active = new Set(),
    cycles = [];
  function visit(node) {
    indices.set(node, index);
    low.set(node, index++);
    stack.push(node);
    active.add(node);
    for (const next of graph.get(node)) {
      if (!indices.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node), low.get(next)));
      } else if (active.has(next))
        low.set(node, Math.min(low.get(node), indices.get(next)));
    }
    if (low.get(node) !== indices.get(node)) return;
    const group = [];
    let member;
    do {
      member = stack.pop();
      active.delete(member);
      group.push(member);
    } while (member !== node);
    if (group.length === 1 && !graph.get(node).includes(node)) return;
    const members = new Set(group),
      start = group.sort()[0];
    function witness(current, path) {
      for (const next of graph
        .get(current)
        .filter((item) => members.has(item))
        .sort()) {
        if (next === start) return [...path, start];
        if (!path.includes(next)) {
          const found = witness(next, [...path, next]);
          if (found) return found;
        }
      }
    }
    cycles.push({ members: group, path: witness(start, [start]) });
  }
  for (const node of [...graph.keys()].sort())
    if (!indices.has(node)) visit(node);
  return cycles;
}

const fictional = (path) =>
  /(^|\/)(demo|fixtures?|measurement-preview)(\/|\.)|(^|\/)demo-clinic\.|(^|\/)mock-visits\./.test(
    path
  );
const production = (path) => !path.startsWith("tests/") && !fictional(path);
const sharedUI = (path) =>
  path.startsWith("components/") ||
  /\/ui\//.test(path) ||
  path === "app/secretary/components.tsx";
const model = (path) =>
  path === "lib/clinical-types.ts" ||
  path.startsWith("features/clinical/model/");

export function inventorySources(sources) {
  const modules = [...sources].map(([path, source]) => {
    const parsed = importsAndMetrics(path, source);
    return {
      path,
      lines: source.trimEnd().split(/\r?\n/).length,
      ...parsed,
      imports: parsed.imports.map((edge) => ({
        ...edge,
        target: resolveLocal(path, edge.specifier, sources),
      })),
    };
  });
  const graph = new Map(
    modules.map((item) => [
      item.path,
      [
        ...new Set(
          item.imports
            .filter((edge) => edge.runtime && edge.target)
            .map((edge) => edge.target)
        ),
      ],
    ])
  );
  const findings = [];
  const byPath = new Map(modules.map((item) => [item.path, item]));
  for (const item of modules) {
    for (const edge of item.imports) {
      const finding = (kind, detail) =>
        findings.push({
          kind,
          path: item.path,
          line: edge.line,
          target: edge.target ?? edge.specifier,
          detail,
        });
      if (
        production(item.path) &&
        (fictional(edge.target ?? edge.specifier) ||
          edge.names.some((name) => /^Demo[A-Z]/.test(name)))
      )
        finding(
          "production-demo",
          `imports ${edge.names.filter((name) => /^Demo[A-Z]/.test(name)).join(", ") || "fictional module"}${edge.runtime ? " (runtime)" : " (type-only)"}`
        );
      if (item.path.startsWith("lib/") && edge.target?.startsWith("app/"))
        finding("lib-route", "lib depends on route-owned code");
      if (
        model(item.path) &&
        (/^react(?:\/|$)/.test(edge.specifier) ||
          edge.target?.startsWith("app/"))
      )
        finding("model-dependency", "clinical model depends on React or app/");
      const target = byPath.get(edge.target);
      if (
        sharedUI(item.path) &&
        (/supabase|server-only/.test(edge.specifier) ||
          /(^|\/)(server|.*actions)\.[^.]+$/.test(edge.target ?? "") ||
          target?.imports.some(
            (dependency) => dependency.specifier === "server-only"
          ) ||
          (edge.target &&
            /^\s*["']use server["']/.test(sources.get(edge.target))))
      )
        finding(
          "shared-ui-server",
          "shared UI depends on server/Supabase code"
        );
      if (
        item.path.startsWith("app/doctor/") &&
        edge.target?.startsWith("app/secretary/")
      )
        finding("cross-role", "Doctor imports Secretary-owned implementation");
    }
    if (
      item.lines >= 400 ||
      (item.lines >= 200 && item.metrics.stateHooks >= 6)
    )
      findings.push({
        kind: "responsibility-signal",
        path: item.path,
        detail: `${item.lines} lines; ${item.metrics.functions} functions; ${item.metrics.stateHooks} state/effect hooks; ${item.metrics.jsxElements} JSX elements`,
      });
  }
  return { modules, cycles: runtimeCycles(graph), findings };
}

export function formatInventory(result) {
  const output = [
    "# Architecture dependency inventory",
    "",
    "Report only: findings do not fail the command or modify source files.",
    "",
    `Scanned ${result.modules.length} source modules.`,
    "",
    "## Runtime import cycles",
    "",
  ];
  if (!result.cycles.length) output.push("None detected.");
  for (const cycle of result.cycles)
    output.push(`- ${cycle.path.map((path) => `\`${path}\``).join(" → ")}`);
  const groups = [
    ["production-demo", "Production/demo coupling"],
    ["lib-route", "lib imports route-owned modules"],
    ["model-dependency", "Clinical model dependencies"],
    ["shared-ui-server", "Shared UI server/Supabase imports"],
    ["cross-role", "Cross-role ownership"],
    ["responsibility-signal", "Size/responsibility signals"],
  ];
  for (const [kind, title] of groups) {
    output.push("", `## ${title}`, "");
    const matches = result.findings.filter((finding) => finding.kind === kind);
    if (!matches.length) output.push("None detected.");
    for (const finding of matches)
      output.push(
        `- \`${finding.path}${finding.line ? ":" + finding.line : ""}\`${finding.target ? ` → \`${finding.target}\`` : ""}: ${finding.detail}`
      );
  }
  output.push(
    "",
    "## Interpretation and limits",
    "",
    "- TypeScript AST distinguishes type-only imports from runtime imports, including re-exports, literal dynamic imports, import types and literal require calls.",
    "- Resolution supports local relative paths, the current @/ alias and conventional extension/index files. External packages, computed imports, custom aliases and runtime execution are not resolved.",
    "- Cycles include literal lazy imports conservatively; they are dependency cycles, not proof of an initialization failure. One witness is printed per strongly connected group.",
    "- Ownership rules are path/name heuristics for this repository. No reported coupling proves fictional data leakage or an authorization defect.",
    "- Size thresholds are >=400 lines, or >=200 lines with >=6 state/effect hooks. Function/JSX counts are review signals, not a complexity score or mandatory file-size limit.",
    "- CSS, SQL, Git conflict history, transitive browser bundles and semantic type provenance are outside this script. No CI/ESLint enforcement is installed.",
    ""
  );
  return output.join("\n");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  console.log(formatInventory(inventorySources(readSources(root))));
}
