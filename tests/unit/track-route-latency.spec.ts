import { expect, test } from "@playwright/test";
import {
  callTrack,
  dataOf,
  errorCodeOf,
  recordBudget,
  stubNumber,
  withUpstreams,
  type UpstreamScenario
} from "../support/unipass-stub";

test.describe.configure({ mode: "parallel", timeout: 45_000 });

test.describe("POST /api/track latency (approval 5)", () => {
  test("NOT_FOUND answers within 3 s at UNI-PASS latency 0.3 s", async () => {
    const number = stubNumber("HBL", 101);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 300 } }], async () => {
      const result = await callTrack(number);
      recordBudget("NOT_FOUND at UNI-PASS latency 0.3 s", result.ms, 3_000);
      expect(result.status).toBe(404);
      expect(errorCodeOf(result)).toBe("NOT_FOUND");
      expect(result.ms).toBeLessThanOrEqual(3_000);
    });
  });

  test("NOT_FOUND answers within 6 s at UNI-PASS latency 1.5 s", async () => {
    const number = stubNumber("HBL", 102);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 1_500 } }], async () => {
      const result = await callTrack(number);
      recordBudget("NOT_FOUND at UNI-PASS latency 1.5 s", result.ms, 6_000);
      expect(result.status).toBe(404);
      expect(errorCodeOf(result)).toBe("NOT_FOUND");
      expect(result.ms).toBeLessThanOrEqual(6_000);
    });
  });

  test("a CARGO number without records answers within 6 s at 1.5 s", async () => {
    const number = stubNumber("CARGO", 103);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 1_500 } }], async () => {
      const result = await callTrack(number);
      expect(result.status).toBe(404);
      expect(result.ms).toBeLessThanOrEqual(6_000);
    });
  });

  test("a DOMESTIC number before arrival answers pending within 6 s at 1.5 s", async () => {
    const number = stubNumber("DOMESTIC", 104);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 1_500 } }], async () => {
      const result = await callTrack(number);
      recordBudget("DOMESTIC pending at UNI-PASS latency 1.5 s", result.ms, 6_000);
      expect(result.status).toBe(200);
      expect(dataOf(result)?.isPending).toBe(true);
      expect(result.ms).toBeLessThanOrEqual(6_000);
    });
  });

  test("a shipment from last year is found in the first wave", async () => {
    const number = stubNumber("HBL", 105);
    await withUpstreams(
      [{ number, unipass: { mode: "ok", latencyMs: 1_500 }, found: { param: "hblNo", yearOffset: -1 } }],
      async (stub) => {
        const result = await callTrack(number);
        expect(result.status).toBe(200);
        expect(result.ms).toBeLessThanOrEqual(2_500);
        expect(stub.calls(number).unipass).toBe(4);
      }
    );
  });

  test("a confirmed empty answer is asked once per year and parameter, never retried", async () => {
    const number = stubNumber("HBL", 106);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 50 } }], async (stub) => {
      const result = await callTrack(number);
      expect(result.status).toBe(404);
      expect(stub.calls(number).unipass).toBe(12);
      expect(stub.calls(number).customstrack).toBe(1);
    });
  });

  test("a UNI-PASS outage answers API_TIMEOUT within 15 s instead of NOT_FOUND", async () => {
    const number = stubNumber("HBL", 107);
    await withUpstreams(
      [{ number, unipass: { mode: "timeout", latencyMs: 0 } }],
      async (stub) => {
        const result = await callTrack(number);
        recordBudget("UNI-PASS outage to API_TIMEOUT", result.ms, 15_000);
        expect(result.status).toBe(504);
        expect(errorCodeOf(result)).toBe("API_TIMEOUT");
        expect(result.ms).toBeLessThanOrEqual(15_000);
        const calls = stub.calls(number);
        expect(calls.unipass).toBe(4);
        expect(calls.customstrack).toBe(1);
        expect(calls.proxy).toBe(1);
      },
      { proxy: true }
    );
  });

  test("fast UNI-PASS errors answer API_TIMEOUT 503 quickly", async () => {
    const number = stubNumber("HBL", 108);
    await withUpstreams([{ number, unipass: { mode: "http500", latencyMs: 100 } }], async () => {
      const result = await callTrack(number);
      expect(result.status).toBe(503);
      expect(errorCodeOf(result)).toBe("API_TIMEOUT");
      expect(result.ms).toBeLessThanOrEqual(3_000);
    });
  });

  test("a stalled UNI-PASS body answers API_TIMEOUT within 15 s", async () => {
    const number = stubNumber("HBL", 109);
    await withUpstreams([{ number, unipass: { mode: "bodyStall", latencyMs: 0 } }], async () => {
      const result = await callTrack(number);
      expect(result.status).toBe(504);
      expect(errorCodeOf(result)).toBe("API_TIMEOUT");
      expect(result.ms).toBeLessThanOrEqual(15_000);
    });
  });

  test("a DOMESTIC carrier result is not held back by a slow customs lookup", async () => {
    const number = stubNumber("DOMESTIC", 110);
    await withUpstreams(
      [{ number, unipass: { mode: "timeout", latencyMs: 0 }, carriers: { mode: "ok", latencyMs: 800, cjFound: true } }],
      async (stub) => {
        const result = await callTrack(number);
        expect(result.status).toBe(200);
        expect(dataOf(result)?.currentStatus).toBe("배송출발");
        expect(dataOf(result)?.customs.events).toHaveLength(0);
        expect(result.ms).toBeLessThanOrEqual(3_500);
        await expect.poll(() => stub.calls(number).unipassAborted).toBe(6);
        // Not cached: the next lookup asks UNI-PASS again, so customs can fill in once it answers.
        const second = await callTrack(number);
        expect(second.status).toBe(200);
        expect(stub.calls(number).unipass).toBe(12);
        await expect.poll(() => stub.calls(number).unipassAborted).toBe(12);
      }
    );
  });

  test("DOMESTIC keeps customs events that arrive within the grace period", async () => {
    const number = stubNumber("DOMESTIC", 111);
    await withUpstreams(
      [
        {
          number,
          unipass: { mode: "ok", latencyMs: 1_500 },
          found: { param: "hblNo", yearOffset: 0 },
          carriers: { mode: "ok", latencyMs: 800, cjFound: true }
        }
      ],
      async () => {
        const result = await callTrack(number);
        expect(result.status).toBe(200);
        expect(dataOf(result)?.customs.events.length).toBeGreaterThan(0);
        expect(result.ms).toBeLessThanOrEqual(2_500);
      }
    );
  });

  test("DOMESTIC pending is not claimed while UNI-PASS is down", async () => {
    const number = stubNumber("DOMESTIC", 112);
    await withUpstreams([{ number, unipass: { mode: "http500", latencyMs: 100 } }], async () => {
      const result = await callTrack(number);
      expect(result.status).toBe(503);
      expect(errorCodeOf(result)).toBe("API_TIMEOUT");
    });
  });

  test("a carrier outage keeps the lookupUnavailable result with the official link even when UNI-PASS is down", async () => {
    const number = stubNumber("DOMESTIC", 113);
    await withUpstreams(
      [
        {
          number,
          unipass: { mode: "http500", latencyMs: 100 },
          carriers: { mode: "unavailable", latencyMs: 100, cjFound: false }
        }
      ],
      async () => {
        const result = await callTrack(number, "HANJIN");
        expect(result.status).toBe(200);
        expect(dataOf(result)?.currentStatus).toBe("조회 지연");
        expect(dataOf(result)?.delivery.lookupUnavailable).toBe(true);
        expect(dataOf(result)?.delivery.trackingUrl).toContain("hanjin.com");
      }
    );
  });

  test("a complete NOT_FOUND is cached briefly", async () => {
    const number = stubNumber("HBL", 114);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 100 } }], async (stub) => {
      expect((await callTrack(number)).status).toBe(404);
      const before = stub.calls(number);
      const second = await callTrack(number);
      expect(second.status).toBe(404);
      expect(second.ms).toBeLessThanOrEqual(200);
      expect(stub.calls(number).unipass).toBe(before.unipass);
      expect(stub.calls(number).customstrack).toBe(before.customstrack);
    });
  });

  test("an incomplete NOT_FOUND is not cached", async () => {
    const number = stubNumber("HBL", 115);
    await withUpstreams(
      [{ number, unipass: { mode: "ok", latencyMs: 100, failYearOffsets: [1, -2, -3, -4] } }],
      async (stub) => {
        expect((await callTrack(number)).status).toBe(404);
        expect((await callTrack(number)).status).toBe(404);
        expect(stub.calls(number).unipass).toBe(24);
      }
    );
  });

  test("sequential lookups never leak concurrency slots", async () => {
    const scenarios = Array.from({ length: 25 }, (_, index): UpstreamScenario => ({
      number: stubNumber("HBL", 200 + index),
      unipass: { mode: "ok", latencyMs: 20 },
      found: { param: "hblNo", yearOffset: 0 }
    }));
    await withUpstreams(scenarios, async () => {
      for (const scenario of scenarios) {
        expect((await callTrack(scenario.number)).status).toBe(200);
      }
      // The same 25 again are cache hits (early return before any upstream call).
      for (const scenario of scenarios) {
        expect((await callTrack(scenario.number)).status).toBe(200);
      }
    });
  });

  test("carrier-first answers release their concurrency slots", async () => {
    const scenarios = Array.from({ length: 20 }, (_, index): UpstreamScenario => ({
      number: stubNumber("DOMESTIC", 400 + index),
      unipass: { mode: "timeout", latencyMs: 0 },
      carriers: { mode: "ok", latencyMs: 20, cjFound: true }
    }));
    const probe = stubNumber("HBL", 420);
    await withUpstreams(
      [...scenarios, { number: probe, unipass: { mode: "ok", latencyMs: 20 }, found: { param: "hblNo", yearOffset: 0 } }],
      async () => {
        // 20 at once fill the in-memory cap; each answers carrier-first after the grace period while UNI-PASS still hangs.
        const results = await Promise.all(scenarios.map((scenario) => callTrack(scenario.number)));
        for (const result of results) {
          expect(result.status).toBe(200);
          expect(result.ms).toBeLessThanOrEqual(3_500);
        }
        // If the carrier-first path kept its slot (e.g. until the background customs work ends), the 20 answers would
        // still hold the whole cap and this lookup would get 429.
        expect((await callTrack(probe)).status).toBe(200);
      }
    );
  });

  test("everything hanging still answers within 15 s", async () => {
    const number = stubNumber("DOMESTIC", 116);
    await withUpstreams(
      [
        {
          number,
          unipass: { mode: "timeout", latencyMs: 0 },
          customstrack: { mode: "timeout", latencyMs: 0 },
          carriers: { mode: "timeout", latencyMs: 0, cjFound: false }
        }
      ],
      async () => {
        const result = await callTrack(number);
        expect(result.ms).toBeLessThanOrEqual(15_000);
        expect(result.status).toBe(200);
        expect(dataOf(result)?.delivery.lookupUnavailable).toBe(true);
      }
    );
  });
});
