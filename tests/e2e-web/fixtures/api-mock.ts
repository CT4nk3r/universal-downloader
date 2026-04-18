/**
 * API mocks for the universal-downloader web E2E suite.
 *
 * The web app talks to a JSON HTTP API (`/v1/*`) with two read-style endpoints
 * the UI cares about (`GET /jobs`, `GET /files`, `GET /healthz`, `POST /probe`,
 * `POST /jobs`, `DELETE /jobs/:id`) and an SSE stream at `/jobs/:id/events`.
 *
 * We expose two equivalent surfaces:
 *
 * 1. `handlers` — pure MSW request handler descriptors. Useful for unit tests
 *    or future browser-worker setups (`msw` is listed as a dependency).
 * 2. `installApiMocks(page, opts)` — a Playwright helper that installs the
 *    same response shapes via `page.route()`. This is what specs use today,
 *    because it works uniformly across chromium/firefox/webkit without a
 *    service worker dance.
 *
 * Tests can pre-seed the in-memory store via `opts.seed` and queue extra
 * progress frames per job via `opts.progress`.
 */
import type { Page, Route } from '@playwright/test';
import { http, HttpResponse } from 'msw';

// ---------------------------------------------------------------------------
// Types (loosely mirror @universal-downloader/shared-types — kept local so
// this package has no workspace dependency).
// ---------------------------------------------------------------------------

export interface MockJob {
  id: string;
  url: string;
  title?: string | null;
  site?: string | null;
  status:
    | 'queued'
    | 'probing'
    | 'downloading'
    | 'postprocessing'
    | 'ready'
    | 'failed'
    | 'cancelled'
    | 'expired';
  thumbnail?: string | null;
  preset?: string | null;
  created_at: string;
  updated_at: string;
  progress?: {
    percent?: number;
    downloaded_bytes?: number;
    total_bytes?: number;
    speed_bps?: number;
    eta_seconds?: number;
  } | null;
  error?: string | null;
}

export interface MockFile {
  id: string;
  job_id: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
  download_url: string;
}

export interface MockProbeResult {
  url: string;
  title: string;
  site: string;
  thumbnail: string | null;
  duration_seconds: number;
  formats: Array<{
    format_id: string;
    ext: string;
    resolution?: string | null;
    fps?: number | null;
    vcodec?: string | null;
    acodec?: string | null;
    filesize?: number | null;
    note?: string | null;
  }>;
}

export interface InstallOptions {
  /** Origin the app calls. Default `http://localhost:8787`. */
  apiOrigin?: string;
  /** Path prefix added to every request. Default `/v1`. */
  apiPrefix?: string;
  /** Pre-seeded jobs returned by `GET /jobs`. */
  seed?: MockJob[];
  /** Pre-seeded files returned by `GET /files`. */
  files?: MockFile[];
  /** Probe response. If absent a default fixture is used. */
  probe?: MockProbeResult;
  /** Optional progress frames pushed over SSE per job id. */
  progress?: Record<string, Array<Partial<MockJob> & { delayMs?: number }>>;
}

// ---------------------------------------------------------------------------
// Default fixtures
// ---------------------------------------------------------------------------

export const DEFAULT_PROBE: MockProbeResult = {
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
  site: 'youtube',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  duration_seconds: 213,
  formats: [
    {
      format_id: '137+140',
      ext: 'mp4',
      resolution: '1920x1080',
      fps: 30,
      vcodec: 'avc1',
      acodec: 'mp4a',
      filesize: 52_428_800,
      note: '1080p',
    },
    {
      format_id: '136+140',
      ext: 'mp4',
      resolution: '1280x720',
      fps: 30,
      vcodec: 'avc1',
      acodec: 'mp4a',
      filesize: 26_214_400,
      note: '720p',
    },
    {
      format_id: '140',
      ext: 'm4a',
      resolution: null,
      fps: null,
      vcodec: 'none',
      acodec: 'mp4a',
      filesize: 3_355_443,
      note: 'audio only',
    },
  ],
};

export const DEFAULT_HISTORY: MockJob[] = [
  {
    id: 'job-ready-1',
    url: 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
    title: 'RickRoll-D (archive)',
    site: 'youtube',
    status: 'ready',
    thumbnail: null,
    preset: 'best',
    created_at: '2026-04-10T12:00:00.000Z',
    updated_at: '2026-04-10T12:05:00.000Z',
    progress: { percent: 100, total_bytes: 41_943_040, downloaded_bytes: 41_943_040 },
    error: null,
  },
  {
    id: 'job-ready-2',
    url: 'https://vimeo.com/123456789',
    title: 'Sintel teaser',
    site: 'vimeo',
    status: 'ready',
    thumbnail: null,
    preset: 'p1080',
    created_at: '2026-04-09T08:30:00.000Z',
    updated_at: '2026-04-09T08:33:11.000Z',
    progress: { percent: 100, total_bytes: 12_582_912, downloaded_bytes: 12_582_912 },
    error: null,
  },
  {
    id: 'job-failed-1',
    url: 'https://example.com/broken',
    title: 'Broken upload',
    site: null,
    status: 'failed',
    thumbnail: null,
    preset: 'best',
    created_at: '2026-04-08T10:00:00.000Z',
    updated_at: '2026-04-08T10:00:30.000Z',
    progress: null,
    error: 'HTTP 403 from upstream',
  },
];

// ---------------------------------------------------------------------------
// MSW handler descriptors (exported for users that wire MSW directly)
// ---------------------------------------------------------------------------

export function buildHandlers(opts: InstallOptions = {}) {
  const origin = opts.apiOrigin ?? 'http://localhost:8787';
  const prefix = opts.apiPrefix ?? '/v1';
  const base = `${origin}${prefix}`;
  const probe = opts.probe ?? DEFAULT_PROBE;
  const seed = opts.seed ?? [];
  const files = opts.files ?? [];

  return [
    http.get(`${base}/healthz`, () => HttpResponse.json({ ok: true })),
    http.get(`${base}/jobs`, () => HttpResponse.json(seed)),
    http.get(`${base}/files`, () => HttpResponse.json(files)),
    http.post(`${base}/probe`, () => HttpResponse.json(probe)),
    http.post(`${base}/jobs`, async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const id = `job-${Date.now()}`;
      const now = new Date().toISOString();
      const created: MockJob = {
        id,
        url: String(body['url'] ?? probe.url),
        title: probe.title,
        site: probe.site,
        status: 'queued',
        thumbnail: probe.thumbnail,
        preset: (body['preset'] as string) ?? 'best',
        created_at: now,
        updated_at: now,
        progress: { percent: 0 },
        error: null,
      };
      return HttpResponse.json(created, { status: 201 });
    }),
    http.delete(`${base}/jobs/:id`, () => new HttpResponse(null, { status: 204 })),
  ];
}

export const handlers = buildHandlers();

// ---------------------------------------------------------------------------
// Playwright installer — what the specs actually use
// ---------------------------------------------------------------------------

function buildSseBody(frames: Array<Partial<MockJob>>): string {
  // Server-Sent Events frame format: "data: {...}\n\n"
  return (
    frames
      .map((frame) => `event: progress\ndata: ${JSON.stringify(frame)}\n\n`)
      .join('') + 'event: end\ndata: {"type":"end"}\n\n'
  );
}

/**
 * Installs HTTP mocks for the web app's API on the given Playwright `page`.
 * Returns helpers to mutate state mid-test (e.g. push a "ready" job).
 */
export async function installApiMocks(page: Page, opts: InstallOptions = {}) {
  const origin = opts.apiOrigin ?? 'http://localhost:8787';
  const prefix = opts.apiPrefix ?? '/v1';
  const base = `${origin}${prefix}`;
  const probe = opts.probe ?? DEFAULT_PROBE;
  const progressMap = opts.progress ?? {};

  // Mutable in-memory state
  const state = {
    jobs: [...(opts.seed ?? [])] as MockJob[],
    files: [...(opts.files ?? [])] as MockFile[],
  };

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

  // Catch-all for the API origin so unknown routes 404 loudly instead of
  // silently hitting the network during tests.
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    // GET /v1/healthz
    if (method === 'GET' && path === `${prefix}/healthz`) {
      return json(route, { ok: true });
    }

    // GET /v1/jobs
    if (method === 'GET' && path === `${prefix}/jobs`) {
      return json(route, state.jobs);
    }

    // GET /v1/files
    if (method === 'GET' && path === `${prefix}/files`) {
      return json(route, state.files);
    }

    // POST /v1/probe
    if (method === 'POST' && path === `${prefix}/probe`) {
      return json(route, probe);
    }

    // POST /v1/jobs
    if (method === 'POST' && path === `${prefix}/jobs`) {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(route.request().postData() ?? '{}');
      } catch {
        body = {};
      }
      const id = `job-${state.jobs.length + 1}-${Date.now()}`;
      const now = new Date().toISOString();
      const created: MockJob = {
        id,
        url: String(body['url'] ?? probe.url),
        title: probe.title,
        site: probe.site,
        status: 'queued',
        thumbnail: probe.thumbnail,
        preset: (body['preset'] as string) ?? 'best',
        created_at: now,
        updated_at: now,
        progress: { percent: 0 },
        error: null,
      };
      state.jobs = [created, ...state.jobs];
      return json(route, created, 201);
    }

    // DELETE /v1/jobs/:id
    if (method === 'DELETE' && path.startsWith(`${prefix}/jobs/`)) {
      const id = path.slice(`${prefix}/jobs/`.length);
      state.jobs = state.jobs.filter((j) => j.id !== id);
      return route.fulfill({ status: 204, body: '' });
    }

    // GET /v1/jobs/:id/events  (SSE)
    if (method === 'GET' && /\/jobs\/[^/]+\/events$/.test(path)) {
      const m = path.match(/\/jobs\/([^/]+)\/events$/);
      const jobId = m ? m[1]! : '';
      const frames = progressMap[jobId] ?? [
        { progress: { percent: 25 }, status: 'downloading' },
        { progress: { percent: 75 }, status: 'downloading' },
        { progress: { percent: 100 }, status: 'ready' },
      ];
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'cache-control': 'no-cache' },
        body: buildSseBody(frames as Array<Partial<MockJob>>),
      });
    }

    // CORS preflight: always allow
    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'access-control-allow-headers': '*',
        },
        body: '',
      });
    }

    // Unknown — fail loudly so the test surfaces the gap.
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'mock-miss', method, path }),
    });
  });

  return {
    state,
    /** Push (or replace) a job into the in-memory store. */
    upsertJob(job: MockJob) {
      const idx = state.jobs.findIndex((j) => j.id === job.id);
      if (idx >= 0) state.jobs[idx] = job;
      else state.jobs = [job, ...state.jobs];
    },
    /** Mark a job ready, e.g. to simulate completion. */
    markReady(id: string) {
      state.jobs = state.jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              status: 'ready',
              progress: { percent: 100, downloaded_bytes: 100, total_bytes: 100 },
              updated_at: new Date().toISOString(),
            }
          : j,
      );
    },
  };
}

/**
 * Pre-seeds the settings-store localStorage so the API key gate is satisfied
 * and the app talks to our mocked origin.
 */
export async function seedSettings(
  page: Page,
  partial: Partial<{ apiBaseUrl: string; apiKey: string; theme: 'light' | 'dark' | 'system' }> = {},
) {
  const value = {
    state: {
      apiBaseUrl: partial.apiBaseUrl ?? 'http://localhost:8787/v1',
      apiKey: partial.apiKey ?? 'test-api-key',
      defaultPreset: 'best',
      theme: partial.theme ?? 'light',
      concurrentLimit: 3,
    },
    version: 1,
  };
  await page.addInitScript((payload) => {
    window.localStorage.setItem('ud-settings', JSON.stringify(payload));
  }, value);
}
