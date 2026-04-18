import { describe, it, expect, vi } from 'vitest';
import { subscribeJobEvents, type JobEvent } from '../index.js';

/**
 * SSE parsing tests. We mock fetch to return a ReadableStream that emits
 * raw `text/event-stream` bytes and assert each event is decoded into the
 * correct JobEvent oneOf member (progress | status | done | error).
 */

const JOB_ID = '00000000-0000-0000-0000-000000000001';

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(enc.encode(chunks[i]!));
        i += 1;
      } else {
        controller.close();
      }
    },
  });
}

function sseResponse(chunks: string[]): Response {
  return new Response(sseStream(chunks), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function fetchReturning(res: Response): typeof fetch {
  return vi.fn(async () => res) as unknown as typeof fetch;
}

// flush microtasks and any queued async work
async function flush() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('subscribeJobEvents', () => {
  it('sends Authorization header and Accept text/event-stream to the events URL', async () => {
    const fetchMock = vi.fn(async (input: Request | string | URL, init?: RequestInit) => {
      let url: string;
      let headers: Headers;
      if (input instanceof Request) {
        url = input.url;
        headers = new Headers(input.headers);
      } else {
        url = String(input);
        headers = new Headers(init?.headers ?? {});
      }
      expect(url).toBe(`https://api.example.test/v1/jobs/${JOB_ID}/events`);
      expect(headers.get('authorization')).toBe('Bearer tok');
      expect(headers.get('accept')).toBe('text/event-stream');
      return sseResponse([]);
    });
    const unsub = subscribeJobEvents(
      { baseUrl: 'https://api.example.test/v1', apiKey: 'tok', fetch: fetchMock as unknown as typeof fetch },
      JOB_ID,
      () => {},
    );
    await flush();
    unsub();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('strips a trailing slash from baseUrl', async () => {
    const fetchMock = vi.fn(async (input: Request | string | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      expect(url).toBe(`https://api.example.test/v1/jobs/${JOB_ID}/events`);
      return sseResponse([]);
    });
    const unsub = subscribeJobEvents(
      { baseUrl: 'https://api.example.test/v1/', apiKey: 'k', fetch: fetchMock as unknown as typeof fetch },
      JOB_ID,
      () => {},
    );
    await flush();
    unsub();
  });

  it('parses each JobEvent oneOf member (progress, status, done, error)', async () => {
    const progress = {
      type: 'progress',
      job_id: JOB_ID,
      progress: { percent: 42, downloaded_bytes: 100, total_bytes: 1000 },
    };
    const status = { type: 'status', job_id: JOB_ID, status: 'running' };
    const done = {
      type: 'done',
      job_id: JOB_ID,
      file: {
        filename: 'video.mp4',
        size_bytes: 1024,
        download_url: 'https://example/file',
      },
    };
    const errorEv = {
      type: 'error',
      job_id: JOB_ID,
      error: { code: 'boom', message: 'kaboom' },
    };

    const chunks = [
      `data: ${JSON.stringify(progress)}\n\n`,
      // multi-line `data:` field is concatenated with \n
      `data: ${JSON.stringify(status)}\n\n`,
      // chunk that spans two parts to exercise buffering
      `data: ${JSON.stringify(done)}\n`,
      `\ndata: ${JSON.stringify(errorEv)}\n\n`,
    ];

    const events: JobEvent[] = [];
    const onError = vi.fn();
    const unsub = subscribeJobEvents(
      {
        baseUrl: 'https://api.example.test/v1',
        apiKey: 'k',
        fetch: fetchReturning(sseResponse(chunks)),
      },
      JOB_ID,
      (e) => events.push(e),
      onError,
    );
    await flush();
    unsub();

    expect(onError).not.toHaveBeenCalled();
    expect(events).toHaveLength(4);
    expect(events[0]).toMatchObject({ type: 'progress', job_id: JOB_ID });
    expect(events[1]).toMatchObject({ type: 'status', status: 'running' });
    expect(events[2]).toMatchObject({ type: 'done' });
    expect(events[3]).toMatchObject({ type: 'error', error: { code: 'boom' } });
  });

  it('ignores comment / non-data lines', async () => {
    const ev = { type: 'status', job_id: JOB_ID, status: 'queued' };
    const chunks = [`: keepalive\nevent: status\ndata: ${JSON.stringify(ev)}\n\n`];
    const got: JobEvent[] = [];
    const unsub = subscribeJobEvents(
      {
        baseUrl: 'https://api.example.test/v1',
        apiKey: 'k',
        fetch: fetchReturning(sseResponse(chunks)),
      },
      JOB_ID,
      (e) => got.push(e),
    );
    await flush();
    unsub();
    expect(got).toEqual([ev]);
  });

  it('reports JSON parse errors via onError without throwing', async () => {
    const chunks = [`data: not-json\n\n`];
    const onError = vi.fn();
    const onEvent = vi.fn();
    const unsub = subscribeJobEvents(
      {
        baseUrl: 'https://api.example.test/v1',
        apiKey: 'k',
        fetch: fetchReturning(sseResponse(chunks)),
      },
      JOB_ID,
      onEvent,
      onError,
    );
    await flush();
    unsub();
    expect(onEvent).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('reports HTTP failure via onError', async () => {
    const onError = vi.fn();
    const unsub = subscribeJobEvents(
      {
        baseUrl: 'https://api.example.test/v1',
        apiKey: 'k',
        fetch: fetchReturning(new Response('nope', { status: 500 })),
      },
      JOB_ID,
      () => {},
      onError,
    );
    await flush();
    unsub();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String((onError.mock.calls[0]![0] as Error).message)).toMatch(/SSE failed: 500/);
  });

  it('returned unsubscribe aborts the underlying request', async () => {
    let captured: AbortSignal | undefined;
    const fetchMock = vi.fn(async (_input: Request | string | URL, init?: RequestInit) => {
      captured = init?.signal ?? undefined;
      // Return a stream that never closes so abort is the only termination.
      return new Response(
        new ReadableStream<Uint8Array>({
          start() {
            /* hold open */
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      );
    });
    const unsub = subscribeJobEvents(
      { baseUrl: 'https://api.example.test/v1', apiKey: 'k', fetch: fetchMock as unknown as typeof fetch },
      JOB_ID,
      () => {},
    );
    await flush();
    expect(captured).toBeInstanceOf(AbortSignal);
    expect(captured!.aborted).toBe(false);
    unsub();
    expect(captured!.aborted).toBe(true);
  });
});
