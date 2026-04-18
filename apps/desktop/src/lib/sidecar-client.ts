/**
 * Local Tauri-sidecar adapter (J1.8).
 *
 * Implements the same callable shape as `createApiClient` from
 * `@universal-downloader/api-client` (which is `openapi-fetch` underneath),
 * but routes every request to the Rust commands defined in
 * `src-tauri/src/sidecar.rs` via `@tauri-apps/api/core invoke()`.
 *
 * The intent is that `apps/desktop/src/lib/local-api.ts` can do:
 *
 *     return input.useLocal ? createSidecarClient() : createApiClient({...});
 *
 * ...with no other call-site changes. Job lifecycle events flow over the
 * Tauri event channel `ud://job-event` (see `JOB_EVENT_CHANNEL` in
 * `sidecar.rs`); use `subscribeJobEventsLocal()` as a drop-in replacement
 * for the SSE-based `subscribeJobEvents()` helper.
 *
 * Tauri command surface consumed (registered in `src-tauri/src/commands.rs`):
 *
 *     sidecar_probe          (url) -> ProbeResult
 *     sidecar_create_job     (req) -> Job
 *     sidecar_get_job        (id)  -> Job
 *     sidecar_list_jobs      (status?, limit?) -> JobList
 *     sidecar_cancel_job     (id)  -> ()
 *     sidecar_open_job_file  (id)  -> string (absolute path)
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import type {
  ApiClient,
  CreateJobRequest,
  Job,
  JobEvent,
  ProbeResult,
} from '@universal-downloader/api-client';

// ---------------------------------------------------------------------------
// Tauri command names + event channel (mirror sidecar.rs)
// ---------------------------------------------------------------------------

export const SidecarCommands = {
  probe: 'sidecar_probe',
  createJob: 'sidecar_create_job',
  getJob: 'sidecar_get_job',
  listJobs: 'sidecar_list_jobs',
  cancelJob: 'sidecar_cancel_job',
  openJobFile: 'sidecar_open_job_file',
} as const;

export const JOB_EVENT_CHANNEL = 'ud://job-event';

// ---------------------------------------------------------------------------
// Result envelope — matches openapi-fetch's `{ data, error, response? }`
// ---------------------------------------------------------------------------

interface SidecarErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

type FetchResult<T> = {
  data?: T;
  error?: SidecarErrorPayload;
  response?: undefined;
};

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<FetchResult<T>> {
  try {
    const data = await invoke<T>(cmd, args);
    return { data };
  } catch (err) {
    const error = normaliseError(err);
    return { error };
  }
}

function normaliseError(err: unknown): SidecarErrorPayload {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    return err as SidecarErrorPayload;
  }
  return { code: 'internal_error', message: String(err) };
}

// ---------------------------------------------------------------------------
// Path -> command dispatch
// ---------------------------------------------------------------------------
//
// openapi-fetch exposes per-method functions: `client.GET('/jobs/{id}', ...)`.
// We implement that surface by pattern-matching path templates and
// rewriting them to `invoke()` calls.

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface OpenApiCallOpts {
  params?: { path?: Record<string, string>; query?: Record<string, unknown> };
  body?: unknown;
}

function pathParam(opts: OpenApiCallOpts | undefined, key: string): string {
  const v = opts?.params?.path?.[key];
  if (v == null) {
    throw new Error(`missing path param: ${key}`);
  }
  return String(v);
}

async function dispatch<T>(
  method: Method,
  path: string,
  opts?: OpenApiCallOpts,
): Promise<FetchResult<T>> {
  // POST /probe  { url } -> ProbeResult
  if (method === 'POST' && path === '/probe') {
    const body = (opts?.body ?? {}) as { url?: string };
    if (!body.url) {
      return { error: { code: 'bad_request', message: 'url is required' } };
    }
    return call<T>(SidecarCommands.probe, { url: body.url });
  }
  // POST /jobs  CreateJobRequest -> Job
  if (method === 'POST' && path === '/jobs') {
    return call<T>(SidecarCommands.createJob, { req: opts?.body as CreateJobRequest });
  }
  // GET /jobs (status?, limit?) -> JobList
  if (method === 'GET' && path === '/jobs') {
    const q = opts?.params?.query ?? {};
    return call<T>(SidecarCommands.listJobs, {
      status: q.status ?? null,
      limit: q.limit ?? null,
    });
  }
  // GET /jobs/{id} -> Job
  if (method === 'GET' && path === '/jobs/{id}') {
    return call<T>(SidecarCommands.getJob, { id: pathParam(opts, 'id') });
  }
  // DELETE /jobs/{id} -> ()
  if (method === 'DELETE' && path === '/jobs/{id}') {
    return call<T>(SidecarCommands.cancelJob, { id: pathParam(opts, 'id') });
  }
  // GET /jobs/{id}/events — handled by subscribeJobEventsLocal, not the
  // request/response client. Reject loudly so misuse is obvious.
  if (path.endsWith('/events')) {
    return {
      error: {
        code: 'bad_request',
        message:
          'SSE endpoints are not invokable in local mode. Use subscribeJobEventsLocal() instead.',
      },
    };
  }
  return {
    error: {
      code: 'not_implemented',
      message: `local sidecar adapter does not implement ${method} ${path}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Construct a local `ApiClient` backed by the Tauri sidecar.
 *
 * We cast through `unknown` because openapi-fetch's `Client<paths>` is a
 * deeply generic type tied to the OpenAPI document; the structural shape
 * (GET/POST/PUT/DELETE/PATCH/OPTIONS/HEAD/TRACE methods accepting
 * `(path, opts)` and returning `{ data, error }`) is what consumers
 * actually rely on.
 */
export function createSidecarClient(): ApiClient {
  const make = (method: Method) =>
    <T = unknown>(path: string, opts?: OpenApiCallOpts) => dispatch<T>(method, path, opts);

  const client = {
    GET: make('GET'),
    POST: make('POST'),
    PUT: make('PUT'),
    DELETE: make('DELETE'),
    PATCH: make('PATCH'),
    HEAD: make('GET'),
    OPTIONS: make('GET'),
    TRACE: make('GET'),
    use(_middleware: unknown): void {
      /* middleware (eg. auth) is a no-op locally — no network roundtrip */
    },
    eject(_middleware: unknown): void {
      /* no-op */
    },
  };

  return client as unknown as ApiClient;
}

// ---------------------------------------------------------------------------
// Job event subscription (drop-in for `subscribeJobEvents`)
// ---------------------------------------------------------------------------

/**
 * Subscribe to local job-lifecycle events for `jobId`.
 *
 * Listens on the global Tauri event channel `ud://job-event` and forwards
 * any payload whose `job_id` matches. Returns an unsubscribe function with
 * the same shape as `subscribeJobEvents()` from `@universal-downloader/api-client`.
 */
export function subscribeJobEventsLocal(
  jobId: string,
  onEvent: (e: JobEvent) => void,
  onError?: (err: unknown) => void,
): () => void {
  let unlisten: UnlistenFn | null = null;
  let cancelled = false;

  listen<JobEvent & { job_id?: string }>(JOB_EVENT_CHANNEL, (msg) => {
    const payload = msg.payload as JobEvent & { job_id?: string };
    if (payload?.job_id && payload.job_id !== jobId) return;
    try {
      onEvent(payload as JobEvent);
    } catch (err) {
      onError?.(err);
    }
  })
    .then((un) => {
      if (cancelled) {
        un();
      } else {
        unlisten = un;
      }
    })
    .catch((err) => onError?.(err));

  return () => {
    cancelled = true;
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
  };
}

// ---------------------------------------------------------------------------
// File access helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the on-disk path of a job's output file via the
 * `sidecar_open_job_file` command, then convert it into a webview-safe
 * URL using Tauri's `convertFileSrc()` (which uses the bundled
 * `asset:` / `tauri:` protocol — *not* the placeholder `ud-file://`
 * scheme used in `Job.file.download_url` for parity with the HTTP API).
 */
export async function resolveJobFileUrl(jobId: string): Promise<string> {
  const path = await invoke<string>(SidecarCommands.openJobFile, { id: jobId });
  return convertFileSrc(path);
}

/** @deprecated retained for symmetry with the HTTP client; prefer `resolveJobFileUrl`. */
export async function getJobFilePath(jobId: string): Promise<string> {
  return invoke<string>(SidecarCommands.openJobFile, { id: jobId });
}

// ---------------------------------------------------------------------------
// Re-exports useful for the React layer
// ---------------------------------------------------------------------------

export type { ApiClient, CreateJobRequest, Job, JobEvent, ProbeResult };
