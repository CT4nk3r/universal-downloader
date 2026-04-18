/**
 * @universal-downloader/shared-types
 *
 * Hand-curated zod schemas mirroring `openapi.yaml`. The OpenAPI spec is the
 * single source of truth; these are convenience runtime validators for clients
 * that need them. The fully-typed TS client lives in `@universal-downloader/api-client`.
 */
import { z } from 'zod';

export const SiteIdSchema = z.enum(['youtube', 'x', 'facebook', 'reddit']);
export type SiteId = z.infer<typeof SiteIdSchema>;

export const QualityPresetSchema = z.enum([
  'best',
  'p2160',
  'p1440',
  'p1080',
  'p720',
  'p480',
  'audio_mp3',
  'audio_m4a',
]);
export type QualityPreset = z.infer<typeof QualityPresetSchema>;

export const ContainerSchema = z.enum(['mp4', 'webm', 'mkv', 'm4a', 'mp3', 'opus']);
export type Container = z.infer<typeof ContainerSchema>;

export const JobStatusSchema = z.enum([
  'queued',
  'probing',
  'downloading',
  'postprocessing',
  'ready',
  'failed',
  'cancelled',
  'expired',
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const TimeRangeSchema = z.object({
  start_seconds: z.number().min(0).optional(),
  end_seconds: z.number().min(0).optional(),
});

export const CreateJobRequestSchema = z.object({
  url: z.string().url(),
  preset: QualityPresetSchema.optional(),
  format_id: z.string().optional(),
  container: ContainerSchema.optional(),
  audio_only: z.boolean().default(false).optional(),
  subtitles: z
    .object({
      enabled: z.boolean().default(false),
      languages: z.array(z.string()).default(['en']),
      embed: z.boolean().default(true),
    })
    .optional(),
  time_range: TimeRangeSchema.optional(),
  embed_thumbnail: z.boolean().default(false).optional(),
  embed_metadata: z.boolean().default(true).optional(),
  filename_template: z.string().optional(),
});
export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

export const ProbeRequestSchema = z.object({ url: z.string().url() });
export type ProbeRequest = z.infer<typeof ProbeRequestSchema>;

/** Recognise a URL → SiteId. Used by clients before hitting the API. */
const SITE_PATTERNS: ReadonlyArray<readonly [SiteId, RegExp]> = [
  ['youtube', /(?:^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i],
  ['x', /(?:^|\.)(twitter\.com|x\.com|t\.co)$/i],
  ['facebook', /(?:^|\.)(facebook\.com|fb\.watch|fb\.com)$/i],
  ['reddit', /(?:^|\.)(reddit\.com|redd\.it)$/i],
];

export function detectSite(url: string): SiteId | null {
  try {
    const host = new URL(url).hostname;
    for (const [id, re] of SITE_PATTERNS) if (re.test(host)) return id;
    return null;
  } catch {
    return null;
  }
}
