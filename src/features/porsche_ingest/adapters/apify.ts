const APIFY_BASE = "https://api.apify.com/v2";

type RetryOptions = {
  retries: number;
  baseDelayMs: number;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= opts.retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === opts.retries) break;
      const jitter = Math.floor(Math.random() * 200);
      await sleep(opts.baseDelayMs * 2 ** attempt + jitter);
      attempt += 1;
    }
  }
  throw lastError;
}

export async function fetchApifyDatasetItems(input: {
  actorId: string;
  token: string;
  actorInput: Record<string, unknown>;
  limit?: number;
}): Promise<Record<string, unknown>[]> {
  const runResponse = await withRetry(async () => {
    const response = await fetch(
      `${APIFY_BASE}/acts/${encodeURIComponent(input.actorId)}/runs?token=${encodeURIComponent(input.token)}&waitForFinish=120`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input.actorInput),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Apify actor run failed (${response.status}): ${body.slice(0, 300)}`);
    }
    return await response.json() as { data?: { defaultDatasetId?: string } };
  }, { retries: 3, baseDelayMs: 500 });

  const datasetId = runResponse?.data?.defaultDatasetId;
  if (!datasetId) throw new Error("Apify run returned no defaultDatasetId");

  const endpoint = `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(input.token)}&clean=true&format=json${input.limit ? `&limit=${input.limit}` : ""}`;

  return await withRetry(async () => {
    const response = await fetch(endpoint);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Apify dataset fetch failed (${response.status}): ${body.slice(0, 300)}`);
    }
    const json = await response.json();
    if (!Array.isArray(json)) throw new Error("Apify dataset payload is not an array");
    return json as Record<string, unknown>[];
  }, { retries: 3, baseDelayMs: 500 });
}
