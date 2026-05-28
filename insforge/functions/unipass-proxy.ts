type TrackingType = "DOMESTIC" | "HBL" | "CARGO" | "UNKNOWN";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const buildRequestUrls = (apiUrl: string, apiKey: string, trackingNumber: string, type: TrackingType): string[] => {
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear + 1, thisYear - 1, thisYear - 2, thisYear - 3, thisYear - 4];

  if (type === "CARGO") {
    return years.map((year) => {
      const params = new URLSearchParams({
        crkyCn: apiKey,
        cargMtNo: trackingNumber,
        blYy: String(year)
      });
      return `${apiUrl}?${params.toString()}`;
    });
  }

  if (type === "HBL") {
    return years.flatMap((year) => {
      const common = { crkyCn: apiKey, blYy: String(year) };
      return [
        `${apiUrl}?${new URLSearchParams({ ...common, hblNo: trackingNumber }).toString()}`,
        `${apiUrl}?${new URLSearchParams({ ...common, mblNo: trackingNumber }).toString()}`
      ];
    });
  }

  if (type === "DOMESTIC") {
    return years.flatMap((year) => {
      const common = { crkyCn: apiKey, blYy: String(year) };
      return [
        `${apiUrl}?${new URLSearchParams({ ...common, hblNo: trackingNumber }).toString()}`,
        `${apiUrl}?${new URLSearchParams({ ...common, mblNo: trackingNumber }).toString()}`,
        `${apiUrl}?${new URLSearchParams({ ...common, cargMtNo: trackingNumber }).toString()}`
      ];
    });
  }

  return [];
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });

export default async function (request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("UNIPASS_API_KEY");
  if (!apiKey) {
    return json({ error: "UNIPASS_API_KEY is not configured" }, 500);
  }

  const apiUrl =
    Deno.env.get("UNIPASS_API_URL") ||
    "https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo";

  const body = await request.json().catch(() => null);
  const trackingNumber = typeof body?.trackingNumber === "string" ? body.trackingNumber.trim() : "";
  const type = typeof body?.type === "string" ? (body.type as TrackingType) : "UNKNOWN";

  if (!trackingNumber || !["DOMESTIC", "HBL", "CARGO"].includes(type)) {
    return json({ error: "Invalid trackingNumber or type" }, 400);
  }

  const urls = buildRequestUrls(apiUrl, apiKey, trackingNumber, type);
  let lastXml = "";

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 tracking.tipoasis.com"
        },
        signal: AbortSignal.timeout(12000)
      });

      if (!response.ok) {
        continue;
      }

      const xml = await response.text();
      lastXml = xml;
      if (xml.includes("<cargCsclPrgsInfoQryVo>") || xml.includes("<cargCsclPrgsInfoDtlQryVo>")) {
        return json({ xml });
      }
    } catch (_error) {
      continue;
    }
  }

  return json({ xml: lastXml });
}
