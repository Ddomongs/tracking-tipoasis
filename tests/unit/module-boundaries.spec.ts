import { expect, test } from "@playwright/test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "config"] as const;
const SOURCE_EXTENSIONS = [".ts", ".tsx"] as const;

interface ImportRef {
  readonly specifier: string;
  readonly typeOnly: boolean;
}

const toPosix = (value: string): string => value.split(path.sep).join("/");

function listSourceFiles(relativeDir: string): string[] {
  const absolute = path.join(ROOT, relativeDir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap((name) => {
    const relative = toPosix(path.join(relativeDir, name));
    if (statSync(path.join(ROOT, relative)).isDirectory()) return listSourceFiles(relative);
    return SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension)) && !name.endsWith(".d.ts") ? [relative] : [];
  });
}

const ALL_FILES: readonly string[] = SCAN_DIRS.flatMap((dir) => listSourceFiles(dir));

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}

/** Removes block and line comments; keeps '//' inside URLs such as https://. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

/** Static import/export-from statements; `import type`/`export type` are marked type-only (erased at build). */
const STATIC_IMPORT = /(?:^|[\n;])\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?["']([^"']+)["']/g;

function importsOf(file: string): readonly ImportRef[] {
  const source = stripComments(read(file));
  return Array.from(source.matchAll(STATIC_IMPORT), (match) => ({ specifier: match[2], typeOnly: match[1] !== undefined }));
}

function localBase(specifier: string, fromFile: string): string | null {
  if (specifier.startsWith("@/")) return specifier.slice(2);
  if (specifier.startsWith(".")) return toPosix(path.join(path.dirname(fromFile), specifier));
  return null;
}

function resolveImport(specifier: string, fromFile: string): string {
  const base = localBase(specifier, fromFile);
  if (base === null) return `pkg:${specifier}`;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  const found = candidates.find((candidate) => {
    const absolute = path.join(ROOT, candidate);
    return existsSync(absolute) && statSync(absolute).isFile();
  });
  return found ?? `missing:${base}`;
}

function runtimeImports(file: string): readonly string[] {
  return importsOf(file).filter((ref) => !ref.typeOnly).map((ref) => resolveImport(ref.specifier, file));
}

function runtimeClosure(entry: string): ReadonlySet<string> {
  const seen = new Set<string>();
  const queue: string[] = [entry];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    if (/\.(ts|tsx)$/.test(current) && !current.startsWith("pkg:") && !current.startsWith("missing:")) {
      queue.push(...runtimeImports(current));
    }
  }
  return seen;
}

const USE_CLIENT = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use client["']/;
const isClientFile = (file: string): boolean => USE_CLIENT.test(read(file));

const INTERNAL_CS_IMPORTERS: readonly RegExp[] = [
  /^components\/InternalCsHelper\.tsx$/, /^components\/internal\//, /^app\/\(internal\)\//, /^lib\/cs\//
];
const CLIENT_SAFE_ENTRIES: readonly string[] = [
  "config/site.config.ts", "lib/tracking/types.ts", "lib/tracking/time.ts", "lib/tracking/number-format.ts",
  "lib/tracking/template.ts", "lib/tracking/glossary.ts", "lib/tracking/notices.ts", "lib/tracking/classify-failure.ts",
  "lib/tracking/loading-view.ts", "lib/tracking/inquiry-copy.ts", "lib/tracking/carriers.ts"
];
const FORBIDDEN_IN_CLIENT: readonly RegExp[] = [
  /^pkg:zod$/, /^lib\/schemas\.ts$/, /^lib\/config\/(schema|invariants|server)\.ts$/, /^lib\/cs\//, /^lib\/delivery-carriers\.ts$/,
  /^lib\/tracking\/derive-view\.ts$/, /^lib\/tracking\/derive\//, /^components\/result\/ResultView\.tsx$/
];
const IMPURE: ReadonlyArray<readonly [string, RegExp]> = [
  ["window", /\bwindow\b/], ["document", /\bdocument\b/], ["fetch()", /\bfetch\s*\(/], ["localStorage", /\blocalStorage\b/],
  ["sessionStorage", /\bsessionStorage\b/], ["Date.now()", /\bDate\.now\s*\(/], ["new Date() without an argument", /\bnew Date\s*\(\s*\)/]
];

function forbiddenReach(entry: string): readonly string[] {
  return [...runtimeClosure(entry)]
    .filter((target) => FORBIDDEN_IN_CLIENT.some((pattern) => pattern.test(target)))
    .map((target) => `${entry} → ${target}`);
}

test("the scanner resolves aliases, relative paths and type-only imports", () => {
  expect(runtimeImports("lib/config/server.ts")).toEqual(
    expect.arrayContaining(["config/site.config.ts", "lib/config/schema.ts", "lib/tracking/time.ts"])
  );
  expect(importsOf("config/site.config.ts").every((ref) => ref.typeOnly)).toBe(true);
  expect([...runtimeClosure("lib/config/schema.ts")]).toContain("pkg:zod");
});

test("lib/cs is imported only by internal files (tests excepted)", () => {
  const offenders = ALL_FILES.filter((file) =>
    runtimeImports(file).some((target) => target.startsWith("lib/cs/")) && !INTERNAL_CS_IMPORTERS.some((pattern) => pattern.test(file))
  );
  expect(offenders).toEqual([]);
});

test("lib/config/server is imported only by server files under app/ or components/shell/", () => {
  const offenders = ALL_FILES.filter((file) =>
    runtimeImports(file).includes("lib/config/server.ts") && (!/^(app|components\/shell)\//.test(file) || isClientFile(file))
  );
  expect(offenders).toEqual([]);
});

test("client-reachable pure modules pull in no zod, config parsing, CS or derive code", () => {
  expect(CLIENT_SAFE_ENTRIES.filter((entry) => !existsSync(path.join(ROOT, entry)))).toEqual([]);
  expect(CLIENT_SAFE_ENTRIES.flatMap(forbiddenReach)).toEqual([]);
});

test("lookup, primitive and client shell components reach none of them statically either", () => {
  const entries = ALL_FILES.filter((file) =>
    /^components\/(lookup|primitives)\//.test(file) || (/^components\/shell\//.test(file) && isClientFile(file))
  );
  expect(entries.flatMap(forbiddenReach)).toEqual([]);
});

test("lib/tracking stays pure: time only from `now`, no browser APIs (fetch-track.ts excepted)", () => {
  const files = ALL_FILES.filter((file) =>
    (file.startsWith("lib/tracking/") && file !== "lib/tracking/fetch-track.ts") || file === "config/site.config.ts"
  );
  const findings = files.flatMap((file) => {
    const source = stripComments(read(file));
    return IMPURE.filter(([, pattern]) => pattern.test(source)).map(([name]) => `${file}: ${name}`);
  });
  expect(files.length).toBeGreaterThan(10);
  expect(findings).toEqual([]);
});
