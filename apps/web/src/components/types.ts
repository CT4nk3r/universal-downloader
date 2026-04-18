/**
 * Local UI-side type mirrors of `openapi.yaml` schemas.
 *
 * The fully-typed shapes will live in `@universal-downloader/api-client`
 * once `pnpm codegen` has run; until then `Schemas['Job']` etc. resolve to
 * `never`. We mirror the contract here so screens can compile under TS strict
 * without `any`. Hook results are cast to these via `as unknown as UiX`.
 */
import type { JobStatus, QualityPreset, SiteId } from '@universal-downloader/shared-types';

export interface UiFormat {
  format_id: string;
  ext: string;
  resolution?: string | null;
  fps?: number | null;
  vcodec?: string | null;
  acodec?: string | null;
  filesize?: number | null;
  tbr?: number | null;
  note?: string | null;
}

export interface UiProbeResult {
  url: string;
  site: SiteId | string;
  title: string;
  uploader?: string | null;
  duration_seconds?: number | null;
  thumbnail?: string | null;
  formats: UiFormat[];
}

export interface UiJobProgress {
  percent?: number | null;
  speed_bps?: number | null;
  eta_seconds?: number | null;
  downloaded_bytes?: number | null;
  total_bytes?: number | null;
}

export interface UiJob {
  id: string;
  url: string;
  title?: string | null;
  site?: SiteId | string | null;
  status: JobStatus;
  preset?: QualityPreset | null;
  progress?: UiJobProgress | null;
  thumbnail?: string | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  output_path?: string | null;
}

export interface UiJobEvent {
  type:
    | 'queued'
    | 'probing'
    | 'downloading'
    | 'postprocessing'
    | 'ready'
    | 'failed'
    | 'cancelled'
    | 'log';
  job_id: string;
  progress?: UiJobProgress | null;
  message?: string | null;
  status?: JobStatus | null;
}

export interface UiHealth {
  status: 'ok' | 'degraded' | string;
  version?: string;
  uptime_seconds?: number;
}
