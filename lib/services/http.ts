const requestWithTimeout = async (input: string, init: RequestInit, timeoutMs = 10000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 tracking.tipoasis.com",
        ...(init.headers ?? {})
      },
      cache: "no-store"
    });
  } finally {
    clearTimeout(timer);
  }
};

export const fetchWithTimeout = async (
  input: string,
  timeoutMs = 10000,
  redirect: RequestRedirect = "follow"
): Promise<Response> => requestWithTimeout(input, { redirect }, timeoutMs);

export const postJsonWithTimeout = async (
  input: string,
  body: unknown,
  timeoutMs = 10000,
  extraHeaders?: Record<string, string>
): Promise<Response> =>
  requestWithTimeout(
    input,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        ...(extraHeaders ?? {})
      }
    },
    timeoutMs
  );

export const postFormWithTimeout = async (
  input: string,
  form: Record<string, string>,
  timeoutMs = 10000,
  extraHeaders?: Record<string, string>,
  redirect: RequestRedirect = "follow"
): Promise<Response> =>
  requestWithTimeout(
    input,
    {
      method: "POST",
      body: new URLSearchParams(form).toString(),
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        ...(extraHeaders ?? {})
      },
      redirect
    },
    timeoutMs
  );

const readStreamTextWithLimit = async (
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  timeoutMs: number,
  tooLargeErrorName: string,
  timeoutErrorName: string
): Promise<string> => {
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel("response body timeout");
  }, timeoutMs);

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("response body too large");
        const error = new Error("Body exceeded size limit");
        error.name = tooLargeErrorName;
        throw error;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    if (timedOut) {
      const error = new Error("Body read timed out");
      error.name = timeoutErrorName;
      throw error;
    }
    return text + decoder.decode();
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
};

export const readTextWithLimit = async (response: Response, maxBytes: number, timeoutMs = 10000): Promise<string> =>
  readStreamTextWithLimit(response.body, maxBytes, timeoutMs, "ExternalBodyTooLargeError", "AbortError");

export const readRequestTextWithLimit = async (
  request: Request,
  maxBytes: number,
  timeoutMs = 5000
): Promise<string> =>
  readStreamTextWithLimit(request.body, maxBytes, timeoutMs, "RequestBodyTooLargeError", "RequestBodyTimeoutError");
