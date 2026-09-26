import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { INTERNAL_TEST_PASSWORD } from "../internal-auth";

interface WorkflowStep {
  readonly name: string;
  readonly body: string;
}

const workflow = readFileSync(path.resolve(__dirname, "..", "..", ".github", "workflows", "ci.yml"), "utf8");
const steps: readonly WorkflowStep[] = workflow
  .split(/\n\s+- name: /)
  .slice(1)
  .map((block) => ({ name: block.split("\n")[0]?.trim() ?? "", body: block }));
const stepIndex = (name: string): number => steps.findIndex((step) => step.name === name);

test("CI builds once, starts next start, then runs E2E against it", () => {
  const build = stepIndex("Build");
  const start = stepIndex("Start production server");
  expect(build).toBeGreaterThan(-1);
  expect(start).toBeGreaterThan(build);
  expect(steps.filter((step) => step.body.includes("npm run test:e2e")).map((step) => step.name)).toEqual([
    "E2E on the production build"
  ]);
  expect(stepIndex("E2E on the production build")).toBeGreaterThan(start);
});

test("the production E2E steps set the flags the specs read", () => {
  const start = steps[stepIndex("Start production server")]?.body ?? "";
  expect(start).toContain("next start --port 43210 --hostname 127.0.0.1");
  expect(start).toContain(`INTERNAL_ACCESS_PASSWORD: ${INTERNAL_TEST_PASSWORD}`);
  const e2e = steps[stepIndex("E2E on the production build")]?.body ?? "";
  expect(e2e).toContain('PLAYWRIGHT_SKIP_WEB_SERVER: "1"');
  expect(e2e).toContain("PW_MODE: production");
});
