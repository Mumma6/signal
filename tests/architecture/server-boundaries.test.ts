import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { toBriefingView } from "@/lib/editions";
import { sampleEdition } from "@/lib/preview";

const src = resolve("src");
function modules(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? modules(join(directory, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(directory, entry.name)]
        : [],
  );
}
function dependencies(file: string) {
  const text = readFileSync(file, "utf8");
  const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  for (const node of parsed.statements) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.importClause?.isTypeOnly) continue;
      const bindings = node.importClause?.namedBindings;
      if (
        bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.length &&
        bindings.elements.every((item) => item.isTypeOnly) &&
        !node.importClause?.name
      )
        continue;
      imports.push(node.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.push(node.moduleSpecifier.text);
  }
  // Dynamic module imports count too; ordinary fetch() calls target the app API.
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      imports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return {
    imports,
    client: parsed.statements.some(
      (node) =>
        ts.isExpressionStatement(node) &&
        ts.isStringLiteral(node.expression) &&
        node.expression.text === "use client",
    ),
  };
}
function localModule(from: string, specifier: string) {
  const base = specifier.startsWith("@/")
    ? join(src, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null;
  if (!base) return null;
  return (
    [base, base + ".ts", base + ".tsx", join(base, "index.ts"), join(base, "index.tsx")].find(
      (file) => existsSync(file) && /\.tsx?$/.test(file),
    ) ?? null
  );
}

describe("server and browser boundaries", () => {
  it("keeps every client entry point's runtime dependency graph free of backend modules", () => {
    const entries = modules(src).filter((file) => dependencies(file).client);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const seen = new Set<string>();
      const queue = [entry];
      while (queue.length) {
        const file = queue.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);
        const { imports } = dependencies(file);
        for (const specifier of imports) {
          expect(specifier, `${entry} reaches ${specifier} through ${file}`).not.toMatch(
            /^(?:server-only|node:|pg$|drizzle-orm(?:\/|$)|cheerio$|fast-xml-parser$|@vercel\/functions$)/,
          );
          const dependency = localModule(file, specifier);
          if (dependency) queue.push(dependency);
        }
      }
    }
  });
  it("marks every backend runtime module as server-only", () => {
    const backend = [
      ...modules(join(src, "lib/db")),
      ...modules(join(src, "lib/editorial")),
      ...modules(join(src, "lib/http")),
      ...modules(join(src, "lib/preview")),
      ...modules(join(src, "lib/pipeline")),
      ...modules(join(src, "lib/sources")),
    ].filter((file) => !file.endsWith("/types.ts"));
    for (const file of backend) expect(dependencies(file).imports, file).toContain("server-only");
  });
  it("uses the real marker to reject ordinary Node imports and permits explicit server CLI execution", () => {
    const code = "import 'server-only'";
    const rejected = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      encoding: "utf8",
    });
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain("Client Component");
    const allowed = spawnSync(
      process.execPath,
      ["--conditions=react-server", "--input-type=module", "-e", code],
      { encoding: "utf8" },
    );
    expect(allowed.status).toBe(0);
  });
  it("serializes only the reading view, excluding pipeline reports and outcomes", () => {
    const view = toBriefingView(sampleEdition);
    expect(Object.keys(view).sort()).toEqual(
      ["date", "stories", "repositories", "themes", "sample", "sampleKind", "partial"].sort(),
    );
    expect(view.stories).toEqual(sampleEdition.stories);
    expect(view.repositories).toEqual(sampleEdition.repositories);
    expect(view).not.toHaveProperty("reports");
    expect(view).not.toHaveProperty("outcomes");
    expect(view).not.toHaveProperty("checkpoint");
  });
});
