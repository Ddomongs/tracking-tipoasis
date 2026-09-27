import { expect, test } from "@playwright/test";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { loadResultModule } from "@/components/result/load-result-module";
// Loads the lazy entry into the Node test runner's CommonJS cache so the loader's dynamic import("./result-module") resolves
// here (as tests/unit/fetch-track.spec.ts does for @/lib/schemas); Next.js code-splits the same import in the browser bundle.
import "@/components/result/result-module";
import { resultCopy, siteConfig } from "@/config/site.config";
import { SiteConfigSchema, formatConfigIssues } from "@/lib/config/schema";
import { deriveTrackingView } from "@/lib/tracking/derive-view";

const ROOT = process.cwd();
/** Static import/export-from statements; `import type`/`export type` are type-only (erased at build). Dynamic import() never matches. */
const STATIC_IMPORT = /(?:^|[\n;])\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?["']([^"']+)["']/g;

/** Files of this stage that ship in the initial bundle; a file is checked once its task has created it. */
const INITIAL_BUNDLE_RESULT_FILES: readonly string[] = [
  "components/result/load-result-module.ts",
  "components/result/LoadingCard.tsx",
  "components/result/ResultSlot.tsx"
];
/** What only the lazy result chunk (or the server) may reach. */
const LAZY_ONLY: readonly RegExp[] = [
  /^pkg:zod$/,
  /^lib\/schemas\.ts$/,
  /^lib\/config\/(schema|invariants|server)\.ts$/,
  /^lib\/cs\//,
  /^lib\/delivery-carriers\.ts$/,
  /^lib\/tracking\/derive-view\.ts$/,
  /^lib\/tracking\/derive\//,
  /^components\/result\/(ResultView\.tsx|result-module\.ts)$/
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

function readSource(file: string): string {
  return stripComments(readFileSync(path.join(ROOT, file), "utf8"));
}

function resolveImport(specifier: string, fromFile: string): string {
  const base = specifier.startsWith("@/")
    ? specifier.slice(2)
    : specifier.startsWith(".")
      ? path.posix.join(path.posix.dirname(fromFile), specifier)
      : null;
  if (base === null) return `pkg:${specifier}`;
  const found = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((candidate) => {
    const absolute = path.join(ROOT, candidate);
    return existsSync(absolute) && statSync(absolute).isFile();
  });
  return found ?? `missing:${base}`;
}

function runtimeImports(file: string): readonly string[] {
  return Array.from(readSource(file).matchAll(STATIC_IMPORT))
    .filter((match) => match[1] === undefined)
    .map((match) => resolveImport(match[2], file));
}

function staticClosure(entry: string): ReadonlySet<string> {
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

test.describe("lazy result module", () => {
  test("loadResultModule returns one memoized module with ResultView, deriveTrackingView and siteConfig", async () => {
    const first = loadResultModule();
    expect(loadResultModule()).toBe(first);
    const loaded = await first;
    expect(typeof loaded.ResultView).toBe("function");
    expect(loaded.deriveTrackingView).toBe(deriveTrackingView);
    expect(loaded.siteConfig).toBe(siteConfig);
  });

  test("a failed import is retried: the loader imports ./result-module and forgets a rejected promise", () => {
    const source = readSource("components/result/load-result-module.ts");
    expect(source).toMatch(/import\(\s*["']\.\/result-module["']\s*\)/);
    expect(source).toMatch(/\.catch\(/);
    expect(source).toMatch(/pending\s*=\s*null/);
  });

  test("the scanner sees ResultView and derive-view behind the lazy entry (self-check)", () => {
    expect([...staticClosure("components/result/result-module.ts")]).toEqual(
      expect.arrayContaining(["components/result/ResultView.tsx", "lib/tracking/derive-view.ts", "config/site.config.ts"])
    );
  });

  test("initial-bundle result files reach no lazy-only module statically", () => {
    const present = INITIAL_BUNDLE_RESULT_FILES.filter((file) => existsSync(path.join(ROOT, file)));
    expect(present).toContain("components/result/load-result-module.ts");
    const offenders = present.flatMap((entry) =>
      [...staticClosure(entry)]
        .filter((target) => LAZY_ONLY.some((pattern) => pattern.test(target)))
        .map((target) => `${entry} → ${target}`)
    );
    expect(offenders).toEqual([]);
  });
});

test("resultCopy carries the return-link and inquiry feedback strings, and the shipped config still parses", () => {
  expect([resultCopy.returnLinkCopied, resultCopy.returnLinkShared, resultCopy.returnLinkFallback, resultCopy.inquiryCopied]).toEqual([
    "링크를 복사했어요",
    "링크를 공유했어요",
    "아래 링크를 길게 눌러 복사해 주세요.",
    "문의 내용을 복사했어요"
  ]);
  const parsed = SiteConfigSchema.safeParse(siteConfig);
  expect(parsed.success ? "" : formatConfigIssues(parsed.error)).toBe("");
});
