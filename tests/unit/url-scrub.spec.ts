import { expect, test } from "@playwright/test";
import { SCRUB_TIMEOUT_MS, isNumberPath, scrubNumberFromUrl } from "@/lib/privacy/url-scrub";
import { FAKE } from "../fixtures/tracking-fixtures";

interface ReplaceCall {
  readonly patched: boolean;
  readonly url: string | undefined;
}

interface FakeBrowser {
  readonly replaceCalls: () => readonly ReplaceCall[];
  readonly href: () => string;
  /** What the App Router's HistoryUpdater insertion effect does on its first commit. */
  readonly commitRouter: () => void;
  /** What the App Router's useEffect does later: patch history.replaceState as an own property. */
  readonly patchHistory: () => void;
  readonly runFrames: (count: number) => Promise<void>;
  /** A back/forward traversal inside the document: the URL changes, then popstate listeners run. */
  readonly popTo: (path: string) => void;
}

const ORIGIN = "https://tracking.tipoasis.com";

function installFakeBrowser(
  startPath: string,
  behaviour: { readonly ignoreUrl?: boolean; readonly throwOnReplace?: boolean } = {}
): FakeBrowser {
  let current = new URL(startPath, ORIGIN);
  const replaceCalls: ReplaceCall[] = [];
  const popListeners: Array<() => void> = [];
  let frames: Array<() => void> = [];

  const applyReplace = (patched: boolean, url: string | undefined): void => {
    replaceCalls.push({ patched, url });
    if (behaviour.throwOnReplace) throw new DOMException("The operation is insecure.", "SecurityError");
    if (url !== undefined && !behaviour.ignoreUrl) current = new URL(url, current);
  };

  class FakeHistory {
    state: unknown = null;
    replaceState(_state: unknown, _unused: string, url?: string): void {
      applyReplace(false, url);
    }
  }
  const history = new FakeHistory();

  const fakeWindow = {
    history,
    location: {
      get pathname(): string {
        return current.pathname;
      },
      get search(): string {
        return current.search;
      },
      get hash(): string {
        return current.hash;
      },
      get href(): string {
        return current.href;
      }
    },
    requestAnimationFrame(callback: () => void): number {
      frames.push(callback);
      return frames.length;
    },
    addEventListener(type: string, listener: () => void): void {
      if (type === "popstate") popListeners.push(listener);
    }
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });

  return {
    replaceCalls: () => [...replaceCalls],
    href: () => current.href,
    commitRouter: () => {
      history.state = { __NA: true };
    },
    patchHistory: () => {
      Object.defineProperty(history, "replaceState", {
        configurable: true,
        value: (_state: unknown, _unused: string, url?: string): void => applyReplace(true, url)
      });
    },
    runFrames: async (count: number) => {
      for (let index = 0; index < count; index += 1) {
        const pending = frames;
        frames = [];
        pending.forEach((callback) => callback());
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    },
    popTo: (path: string) => {
      current = new URL(path, ORIGIN);
      popListeners.forEach((listener) => listener());
    }
  };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

test.afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

test("isNumberPath accepts one number-like segment and nothing else", () => {
  const numberPaths = [`/${FAKE.domestic}`, `/${FAKE.hbl}`, `/${FAKE.cargo}`, "/0000%201234%205678", `/${FAKE.deepLinkInvalid}`];
  const otherPaths = [
    "/",
    "",
    "/privacy",
    "/guide",
    "/guide/faq",
    "/internal",
    "/internal/cs-helper",
    "/api",
    "/api/track",
    "/robots.txt",
    "/sitemap.xml",
    "/icon.svg",
    `/${FAKE.domestic}.html`,
    `/${FAKE.domestic}/`,
    `/a/${FAKE.domestic}`
  ];
  for (const path of numberPaths) expect(isNumberPath(path), path).toBe(true);
  for (const path of otherPaths) expect(isNumberPath(path), path).toBe(false);
});

test("SCRUB_TIMEOUT_MS is 15 seconds", () => {
  expect(SCRUB_TIMEOUT_MS).toBe(15000);
});

test("'/' needs no scrub and history is untouched", async () => {
  const browser = installFakeBrowser("/");
  let stashed = 0;
  const status = await scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => { stashed += 1; } });
  expect(status).toBe("notNeeded");
  expect(stashed).toBe(0);
  expect(browser.replaceCalls()).toEqual([]);
});

test("waits for the router commit and the history patch, stashes, then replaces path, query and hash with '/'", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}?c=CJ#top`);
  const events: string[] = [];
  const pending = scrubNumberFromUrl({
    timeoutMs: 5000,
    beforeReplace: () => {
      events.push(`stash after ${browser.replaceCalls().length} replace calls`);
    }
  });
  await browser.runFrames(2);
  expect(browser.replaceCalls()).toEqual([]);
  browser.commitRouter();
  await browser.runFrames(2);
  // __NA alone is not enough: the router patches replaceState in a later effect.
  expect(browser.replaceCalls()).toEqual([]);
  browser.patchHistory();
  await browser.runFrames(1);
  expect(await pending).toBe("scrubbed");
  expect(events).toEqual(["stash after 0 replace calls"]);
  expect(browser.replaceCalls()).toEqual([{ patched: true, url: "/" }]);
  expect(browser.href()).toBe(`${ORIGIN}/`);
});

test("fails closed when the router never commits before the timeout", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}`);
  let stashed = 0;
  const pending = scrubNumberFromUrl({ timeoutMs: 20, beforeReplace: () => { stashed += 1; } });
  await sleep(40);
  await browser.runFrames(1);
  expect(await pending).toBe("failed");
  expect(stashed).toBe(0);
  expect(browser.replaceCalls()).toEqual([]);
  expect(browser.href()).toBe(`${ORIGIN}/${FAKE.domestic}`);
});

test("late first frame (background tab): a ready router is used even after the timeout elapsed", async () => {
  const browser = installFakeBrowser(`/${FAKE.hbl}`);
  const pending = scrubNumberFromUrl({ timeoutMs: 20, beforeReplace: () => undefined });
  browser.commitRouter();
  browser.patchHistory();
  await sleep(40);
  await browser.runFrames(1);
  expect(await pending).toBe("scrubbed");
  expect(browser.href()).toBe(`${ORIGIN}/`);
});

test("a throwing stash does not stop the scrub", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}`);
  browser.commitRouter();
  browser.patchHistory();
  const pending = scrubNumberFromUrl({
    timeoutMs: 1000,
    beforeReplace: () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    }
  });
  await browser.runFrames(1);
  expect(await pending).toBe("scrubbed");
  expect(browser.href()).toBe(`${ORIGIN}/`);
});

test("fails when replaceState throws", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}`, { throwOnReplace: true });
  browser.commitRouter();
  browser.patchHistory();
  const pending = scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => undefined });
  await browser.runFrames(1);
  expect(await pending).toBe("failed");
});

test("fails when the browser keeps the old URL", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}`, { ignoreUrl: true });
  browser.commitRouter();
  browser.patchHistory();
  const pending = scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => undefined });
  await browser.runFrames(1);
  expect(await pending).toBe("failed");
  expect(browser.href()).toBe(`${ORIGIN}/${FAKE.domestic}`);
});

test("concurrent calls (React Strict Mode effects) share one scrub", async () => {
  const browser = installFakeBrowser(`/${FAKE.hbl}`);
  browser.commitRouter();
  browser.patchHistory();
  let stashed = 0;
  const first = scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => { stashed += 1; } });
  const second = scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => { stashed += 1; } });
  expect(second).toBe(first);
  await browser.runFrames(1);
  expect(await first).toBe("scrubbed");
  expect(stashed).toBe(1);
  expect(browser.replaceCalls()).toHaveLength(1);
});

test("a dot path or a query that still carries a number is scrubbed too", async () => {
  for (const start of [`/${FAKE.domestic}.html`, `/?q=${FAKE.hbl}`]) {
    const browser = installFakeBrowser(start);
    browser.commitRouter();
    browser.patchHistory();
    const pending = scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => undefined });
    await browser.runFrames(1);
    expect(await pending, start).toBe("scrubbed");
    expect(browser.href(), start).toBe(`${ORIGIN}/`);
    Reflect.deleteProperty(globalThis, "window");
  }
});

test("never throws without a window", async () => {
  expect(await scrubNumberFromUrl({ timeoutMs: 10, beforeReplace: () => undefined })).toBe("failed");
});

test("history guard: after a scrub, back/forward to a number URL is replaced with '/' at once", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}`);
  browser.commitRouter();
  browser.patchHistory();
  const pending = scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => undefined });
  await browser.runFrames(1);
  expect(await pending).toBe("scrubbed");

  browser.popTo(`/${FAKE.domestic}`);
  expect(browser.href()).toBe(`${ORIGIN}/`);
  browser.popTo(`/?c=CJ#${FAKE.hbl}`);
  expect(browser.href()).toBe(`${ORIGIN}/`);
  browser.popTo("/privacy");
  expect(browser.href()).toBe(`${ORIGIN}/privacy`);
  expect(browser.replaceCalls().map((call) => call.url)).toEqual(["/", "/", "/"]);
});

test("no history guard when the router never became ready", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}`);
  const pending = scrubNumberFromUrl({ timeoutMs: 20, beforeReplace: () => undefined });
  await sleep(40);
  await browser.runFrames(1);
  expect(await pending).toBe("failed");
  browser.popTo(`/${FAKE.hbl}`);
  expect(browser.replaceCalls()).toEqual([]);
});
