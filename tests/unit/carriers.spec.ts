import { expect, test } from "@playwright/test";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import {
  CARRIER_NAMES, CONCRETE_CARRIER_CODES, carrierDisplayName, carrierOfficialUrl, isConcreteCarrier, requestCarrierView
} from "@/lib/tracking/carriers";
import { DELIVERY_CARRIER_CODES } from "@/lib/types";
import { FAKE } from "../fixtures/tracking-fixtures";

test("the concrete carrier list is every carrier code except AUTO", () => {
  expect([...CONCRETE_CARRIER_CODES]).toEqual(DELIVERY_CARRIER_CODES.filter((code) => code !== "AUTO"));
  expect(isConcreteCarrier("AUTO")).toBe(false);
  expect(isConcreteCarrier("CJ")).toBe(true);
});

test("names and official URLs match lib/delivery-carriers.ts for every carrier", () => {
  for (const code of CONCRETE_CARRIER_CODES) {
    expect(CARRIER_NAMES[code]).toBe(getDeliveryCarrier(code).name);
    expect(carrierOfficialUrl(code, FAKE.domestic)).toBe(getDeliveryCarrier(code).trackingUrl(FAKE.domestic));
  }
});

test("AUTO or an empty number has no official URL", () => {
  expect(carrierOfficialUrl("AUTO", FAKE.domestic)).toBeNull();
  expect(carrierOfficialUrl("CJ", "")).toBeNull();
});

test("display names never show the internal automatic-lookup label", () => {
  expect(carrierDisplayName("택배사 자동 확인", "AUTO")).toBeNull();
  expect(carrierDisplayName("국내택배 자동 조회", "AUTO")).toBeNull();
  expect(carrierDisplayName(undefined, "AUTO")).toBeNull();
  expect(carrierDisplayName("CJ대한통운", "CJ")).toBe("CJ대한통운");
  expect(carrierDisplayName("", "HANJIN")).toBe("한진택배");
  expect(carrierDisplayName("택배사 자동 확인", "LOTTE")).toBe("롯데택배");
  expect(carrierDisplayName("한진택배", "AUTO")).toBe("한진택배");
});

test("request carrier view uses the given label while the carrier is unknown", () => {
  expect(requestCarrierView({ number: FAKE.domestic, carrier: "AUTO", entry: "manual" }, "택배사 자동 확인")).toEqual({
    code: "AUTO", name: null, barLabel: "택배사 자동 확인", officialUrl: null
  });
  expect(requestCarrierView({ number: FAKE.domestic, carrier: "CJ", entry: "deepLink" }, "택배사 자동 확인")).toEqual({
    code: "CJ", name: "CJ대한통운", barLabel: "CJ대한통운", officialUrl: carrierOfficialUrl("CJ", FAKE.domestic)
  });
});
