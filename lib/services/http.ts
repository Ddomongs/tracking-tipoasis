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

export const fetchWithTimeout = async (input: string, timeoutMs = 10000): Promise<Response> =>
  requestWithTimeout(input, {}, timeoutMs);

export const postFormWithTimeout = async (
  input: string,
  form: Record<string, string>,
  timeoutMs = 10000,
  extraHeaders?: Record<string, string>
): Promise<Response> =>
  requestWithTimeout(
    input,
    {
      method: "POST",
      body: new URLSearchParams(form).toString(),
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        ...(extraHeaders ?? {})
      }
    },
    timeoutMs
  );
