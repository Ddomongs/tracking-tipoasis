export type CopyToken = "etaDate" | "worryDate" | "lastEventDate" | "carrier" | "staleDays";

export const COPY_TOKENS: readonly CopyToken[] = ["etaDate", "worryDate", "lastEventDate", "carrier", "staleDays"];

const TOKEN_PATTERN = /\{([A-Za-z]+)\}/g;

export function tokensIn(template: string): readonly string[] {
  return Array.from(template.matchAll(TOKEN_PATTERN), (match) => match[1]);
}

/** Replaces every `{name}` with values[name]; unknown or missing names become ''. */
export function fillSlots(template: string, values: Readonly<Record<string, string | undefined>>): string {
  return template.replace(TOKEN_PATTERN, (_whole: string, name: string) => values[name] ?? "");
}

/** stateGuide copy: only the five CopyTokens have values. Unknown tokens are rejected by the config schema. */
export function fillCopy(template: string, values: Readonly<Partial<Record<CopyToken, string>>>): string {
  return fillSlots(template, values);
}
