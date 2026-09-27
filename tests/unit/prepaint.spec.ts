import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";
import nextConfig from "@/next.config";
import { PREPAINT_CSP_SOURCE, PREPAINT_SCRIPT, PREPAINT_SCRIPT_ID, PREPAINT_SCRIPT_SHA256 } from "@/lib/style/prepaint";
import { DARK_STYLE_ID, DEFAULT_STYLE_ID, STYLE_IDS, STYLE_STORAGE_KEY } from "@/lib/style/styles";

interface PrepaintCase {
  readonly stored?: string | null;
  readonly storageThrows?: boolean;
  readonly followDark: "1" | "0" | null;
  readonly dark: boolean;
  readonly noMatchMedia?: boolean;
}

/** Runs the exact script text against a fake document, storage and media query; returns the data-style it set. */
function runPrepaint(input: PrepaintCase): string | null {
  const attributes = new Map<string, string>();
  if (input.followDark !== null) attributes.set("data-follow-dark", input.followDark);
  const documentElement = {
    getAttribute: (name: string): string | null => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string): void => {
      attributes.set(name, value);
    }
  };
  const fakeWindow: Record<string, unknown> = {};
  Object.defineProperty(fakeWindow, "localStorage", {
    get() {
      if (input.storageThrows === true) throw new Error("SecurityError: storage is blocked");
      return { getItem: (key: string): string | null => (key === STYLE_STORAGE_KEY ? (input.stored ?? null) : null) };
    }
  });
  if (input.noMatchMedia !== true) {
    fakeWindow.matchMedia = (query: string): { readonly matches: boolean } => ({
      matches: query === "(prefers-color-scheme: dark)" && input.dark
    });
  }
  runInNewContext(PREPAINT_SCRIPT, { window: fakeWindow, document: { documentElement } });
  return attributes.get("data-style") ?? null;
}

test("the script text and its SHA-256 are pinned together", () => {
  expect(createHash("sha256").update(PREPAINT_SCRIPT, "utf8").digest("base64")).toBe(PREPAINT_SCRIPT_SHA256);
  expect(PREPAINT_CSP_SOURCE).toBe(`'sha256-${PREPAINT_SCRIPT_SHA256}'`);
  expect(PREPAINT_SCRIPT_ID).toBe("tt-prepaint");
});

test("the script uses the storage key and the style ids of lib/style/styles.ts", () => {
  expect(PREPAINT_SCRIPT).toContain(`getItem("${STYLE_STORAGE_KEY}")`);
  for (const id of STYLE_IDS) expect(PREPAINT_SCRIPT).toContain(`"${id}"`);
  expect(PREPAINT_SCRIPT).toContain(`s="${DEFAULT_STYLE_ID}"`);
  expect(PREPAINT_SCRIPT).toContain(`s="${DARK_STYLE_ID}"`);
});

test("first visit: signal on a light device, night on a dark device when following it, signal when the switch is off", () => {
  expect(runPrepaint({ followDark: "1", dark: false })).toBe("signal");
  expect(runPrepaint({ followDark: "1", dark: true })).toBe("night");
  expect(runPrepaint({ followDark: "0", dark: true })).toBe("signal");
  expect(runPrepaint({ followDark: null, dark: true })).toBe("signal");
});

test("a stored valid choice always wins; an unknown stored value falls back to the first-visit rule", () => {
  expect(runPrepaint({ stored: "manifest", followDark: "1", dark: true })).toBe("manifest");
  expect(runPrepaint({ stored: "signal", followDark: "1", dark: true })).toBe("signal");
  expect(runPrepaint({ stored: "night", followDark: "0", dark: false })).toBe("night");
  expect(runPrepaint({ stored: "dark", followDark: "1", dark: false })).toBe("signal");
  expect(runPrepaint({ stored: "dark", followDark: "1", dark: true })).toBe("night");
});

test("storage that throws (in-app browsers, private windows) and a missing matchMedia never stop the script", () => {
  expect(runPrepaint({ storageThrows: true, followDark: "1", dark: false })).toBe("signal");
  expect(runPrepaint({ storageThrows: true, followDark: "1", dark: true })).toBe("night");
  expect(runPrepaint({ stored: "manifest", noMatchMedia: true, followDark: "1", dark: true })).toBe("manifest");
  expect(runPrepaint({ noMatchMedia: true, followDark: "1", dark: true })).toBe("signal");
});

test("next.config puts the hash into the Report-Only script-src and keeps the enforced CSP free of script rules", async () => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const allRoutes = rules.find((rule) => rule.source === "/:path*");
  expect(allRoutes, "the all-routes header rule").toBeDefined();
  const valueOf = (key: string): string => allRoutes?.headers.find((header) => header.key === key)?.value ?? "";
  const scriptSrc = valueOf("Content-Security-Policy-Report-Only")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("script-src"));
  expect(scriptSrc).toContain(PREPAINT_CSP_SOURCE);
  expect(valueOf("Content-Security-Policy")).not.toContain("script-src");
});

test("only the root layout, the style modules and the picker read or write the style (style-independent DOM, S08)", () => {
  const ROOT = process.cwd();
  const ALLOWED = new Set([
    "app/layout.tsx",
    "lib/style/styles.ts",
    "lib/style/prepaint.ts",
    "lib/style/style-choice.ts",
    "components/shell/StylePicker.tsx"
  ]);
  const STYLE_ACCESS = /data-style|dataset\.style|STYLE_STORAGE_KEY|tt:style|applyStyleChoice|readAppliedStyle/;
  const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
  const walk = (dir: string): string[] =>
    readdirSync(path.join(ROOT, dir)).flatMap((name) => {
      const relative = `${dir}/${name}`;
      if (statSync(path.join(ROOT, relative)).isDirectory()) return walk(relative);
      return /\.(ts|tsx)$/.test(name) ? [relative] : [];
    });
  const offenders = ["app", "components", "lib", "config"]
    .flatMap(walk)
    .filter((file) => !ALLOWED.has(file) && STYLE_ACCESS.test(stripComments(readFileSync(path.join(ROOT, file), "utf8"))));
  expect(offenders).toEqual([]);
});
