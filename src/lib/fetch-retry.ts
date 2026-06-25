/**
 * fetch() wrapper with retry, exponential backoff + jitter, and per-attempt timeout.
 * Only retries on 5xx or network errors — 4xx responses return immediately.
 */
export async function fetchWithRetry(
  input: string | URL | Request,
  init?: RequestInit & { retries?: number; timeoutMs?: number },
): Promise<Response> {
  const { retries = 2, timeoutMs = 10_000, ...fetchInit } = init ?? {};
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(input, { ...fetchInit, signal: controller.signal });
      clearTimeout(timer);

      if (res.ok || res.status < 500) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }

    if (attempt < retries) {
      const base = 1000 * 2 ** attempt;
      const jitter = base * 0.25 * (Math.random() * 2 - 1);
      await new Promise(r => setTimeout(r, base + jitter));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
