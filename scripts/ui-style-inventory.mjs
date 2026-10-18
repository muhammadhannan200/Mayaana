import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

// Inventory only authored application CSS. This is informational, not a token policy.
const sourceRoot = "app";
const colors = new Map();
const spacing = new Map();
const declarations = new Map();
const colorPattern = /#[\da-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|color)\([^)]*\)|\b(?:white|black)\b/gi;
const spacingPattern = /(?<![\w.-])-?(?:\d*\.)?\d+(?:px|rem|em)\b/g;
const spacingProperty = /^(?:margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left)(?:-(?:top|right|bottom|left|inline|block|start|end))*$/;

function record(group, value, location) {
  const occurrences = group.get(value) ?? [];
  occurrences.push(location);
  group.set(value, occurrences);
}

async function cssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return cssFiles(path);
      return entry.isFile() && path.endsWith(".css") ? [path] : [];
    })
  );
  return nested.flat().sort();
}

const files = await cssFiles(sourceRoot);
for (const file of files) {
  const source = (await readFile(file, "utf8")).replace(
    /\/\*[\s\S]*?\*\//g,
    (comment) => comment.replace(/[^\n]/g, " ")
  );
  const fileName = relative(".", file).replaceAll("\\", "/");

  for (const [index, line] of source.split("\n").entries()) {
    const location = `${fileName}:${index + 1}`;
    for (const match of line.matchAll(
      /(?:^|[;{}])\s*([\w-]+)\s*:\s*([^;{}]+)\s*(?=;|}|$)/g
    )) {
      const property = match[1].toLowerCase();
      const value = match[2].trim().replace(/\s+/g, " ");
      record(declarations, `${property}: ${value}`, location);

      for (const color of value.matchAll(colorPattern)) {
        record(colors, color[0].toLowerCase(), location);
      }
      if (spacingProperty.test(property)) {
        for (const length of value.matchAll(spacingPattern)) {
          record(spacing, length[0], location);
        }
      }
    }
  }
}

function printGroup(title, group, repeatedOnly = false) {
  console.log(`\n${title}`);
  const entries = [...group].filter(
    ([, locations]) => !repeatedOnly || locations.length > 1
  );
  if (entries.length === 0) console.log("  none");
  for (const [value, locations] of entries.sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    console.log(`  ${value} (${locations.length}): ${locations.join(", ")}`);
  }
}

console.log(
  `UI styling inventory — ${files.length} authored CSS file(s); informational only`
);
printGroup("Literal colors", colors);
printGroup("Repeated spacing values", spacing, true);
printGroup("Repeated declarations", declarations, true);
