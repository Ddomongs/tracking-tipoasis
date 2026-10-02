import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RETIRED_FILES = [
  "insforge/functions/unipass-proxy.ts",
  ".github/workflows/deploy-insforge.yml",
  "docs/insforge-deployment-runbook.md"
];
const SCANNED_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "DEPLOYMENT.md",
  "README.md",
  ".env.example",
  "package.json",
  "lib/services/customs.ts",
  "lib/services/lookup-budget.ts"
];

test("the InsForge proxy files are gone", () => {
  for (const file of RETIRED_FILES) expect(existsSync(path.join(ROOT, file)), file).toBe(false);
});

test("no document or config still points at the InsForge proxy", () => {
  for (const file of SCANNED_FILES) {
    const text = readFileSync(path.join(ROOT, file), "utf8");
    expect(text, file).not.toMatch(/insforge\.app|insforge\.site|UNIPASS_PROXY_(URL|SECRET)|insforge:(current|deploy)|unipass-proxy/i);
  }
});
