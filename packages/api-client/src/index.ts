/**
 * Universal Downloader API client.
 *
 * Provides a typed `openapi-fetch` client + a small SSE helper for job events.
 * Generated types live in `./generated/schema.ts` (run `pnpm codegen`).
 */
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths, components } from './generated/schema';

export type Schemas = components['schemas'];
export type Job = Schemas['Job'];
export type JobStatus = Schemas['JobStatus'];
export type JobEvent = Schemas['JobEvent'];
export type ProbeResult = Schemas['ProbeResult'];
export type CreateJobRequest = Schemas['CreateJobRequest'];

export interface ApiClientOptions {
  /** Base URL of the API, e.g. `http://localhost:8787/v1`. */
  baseUrl: string;
  /** Bearer API key. Sent as `Authorization: Bearer <key>`. */
  apiKey: string;
  /** Optional override for the global `fetch`. */
  fetch?: typeof fetch;
}

export type ApiClient = ReturnType<typeof createClient<paths>>;

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const auth: Middleware = {
    async onRequest({ request }) {
      request.headers.set('Authorization', `Bearer ${opts.apiKey}`);
      return request;
    },
  };
  const client = createClient<paths>({
    baseUrl: opts.baseUrl,
    fetch: opts.fetch,
  });
  client.use(auth);
  return client;
}

/**
 * Subscribe to SSE job events. Returns an unsubscribe function.
 * Uses `fetch` + a manual SSE parser so it works in browsers, Node, RN, and Tauri.
 */
export function subscribeJobEvents(
  opts: ApiClientOptions,
  jobId: string,
  onEvent: (e: JobEvent) => void,
  onError?: (err: unknown) => void,
): () => void {
  const ctrl = new AbortController();
  const url = `${opts.baseUrl.replace(/\/$/, '')}/jobs/${jobId}/events`;
  (opts.fetch ?? fetch)(url, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    signal: ctrl.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) throw new Error(`SSE failed: ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          const data = part
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).trim())
            .join('\n');
          if (!data) continue;
          try {
            onEvent(JSON.parse(data) as JobEvent);
          } catch (err) {
            onError?.(err);
          }
        }
      }
    })
    .catch((err) => {
      if ((err as { name?: string }).name !== 'AbortError') onError?.(err);
    });
  return () => ctrl.abort();
}

export type { paths, components };
