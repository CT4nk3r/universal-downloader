import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiClient } from '../index.js';

/**
 * These tests assert the wiring between `createApiClient` and `openapi-fetch`:
 *  - baseUrl is honored
 *  - Authorization: Bearer <key> middleware is applied to every request
 *  - The injected `fetch` impl is what gets called
 *  - Response parsing returns `{ data }` / `{ error }` per openapi-fetch contract
 */

interface CapturedRequest {
  url: string;
  init: RequestInit | undefined;
  authorization: string | null;
  accept: string | null;
}

function makeFetchMock(response: Response) {
  const calls: CapturedRequest[] = [];
  const fn = vi.fn(async (input: Request | string | URL, init?: RequestInit) => {
    // openapi-fetch passes a Request object to middleware; the underlying
    // fetch may receive either a Request or a URL string depending on version.
    let url: string;
    let headers: Headers;
    if (input instanceof Request) {
      url = input.url;
      headers = new Headers(input.headers);
    } else {
      url = String(input);
      headers = new Headers(init?.headers ?? {});
    }
    calls.push({
      url,
      init,
      authorization: headers.get('authorization'),
      accept: headers.get('accept'),
    });
    return response.clone();
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('createApiClient', () => {
  it('returns an object exposing GET/POST/DELETE/etc verbs', () => {
    const client = createApiClient({
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'k',
      fetch: makeFetchMock(new Response('{}', { status: 200 })).fn,
    });
    expect(typeof client.GET).toBe('function');
    expect(typeof client.POST).toBe('function');
    expect(typeof client.DELETE).toBe('function');
    expect(typeof client.use).toBe('function');
  });

  it('hits baseUrl + path and attaches Authorization: Bearer <key>', async () => {
    const body = JSON.stringify({ jobs: [], next_cursor: null });
    const { fn, calls } = makeFetchMock(
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'sek-ret-123',
      fetch: fn,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any).GET('/jobs');

    expect(error).toBeUndefined();
    expect(data).toEqual({ jobs: [], next_cursor: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.example.test/v1/jobs');
    expect(calls[0]!.authorization).toBe('Bearer sek-ret-123');
  });

  it('attaches the Bearer header on POST requests too', async () => {
    const { fn, calls } = makeFetchMock(
      new Response(JSON.stringify({ id: '00000000-0000-0000-0000-000000000001' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'tok',
      fetch: fn,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).POST('/jobs', {
      body: { url: 'https://x', preset_id: 'mp4-1080' },
    });
    expect(calls[0]!.authorization).toBe('Bearer tok');
    expect(calls[0]!.url).toBe('https://api.example.test/v1/jobs');
  });

  it('surfaces non-2xx responses as { error } instead of throwing', async () => {
    const { fn } = makeFetchMock(
      new Response(JSON.stringify({ error: { code: 'not_found', message: 'missing' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'k',
      fetch: fn,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any).GET('/jobs/{id}', {
      params: { path: { id: '00000000-0000-0000-0000-000000000001' } },
    });
    expect(data).toBeUndefined();
    expect(error).toEqual({ error: { code: 'not_found', message: 'missing' } });
  });

  it('uses the global fetch when none is supplied', async () => {
    const spy = vi.fn(async () =>
      new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const original = globalThis.fetch;
    globalThis.fetch = spy as unknown as typeof fetch;
    try {
      const client = createApiClient({
        baseUrl: 'https://api.example.test/v1',
        apiKey: 'k',
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any).GET('/jobs');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
