import type { QualityPreset } from '@universal-downloader/shared-types';

export const PRESET_LABELS: Record<QualityPreset, string> = {
  best: 'Best available',
  p2160: '2160p (4K)',
  p1440: '1440p (2K)',
  p1080: '1080p (Full HD)',
  p720: '720p (HD)',
  p480: '480p',
  audio_mp3: 'Audio only — MP3',
  audio_m4a: 'Audio only — M4A',
};

export const PRESET_DESCRIPTIONS: Record<QualityPreset, string> = {
  best: 'Highest quality video + audio the source provides.',
  p2160: 'Ultra HD — best where available, falls back to next-lower.',
  p1440: 'Quad HD — good balance of quality and size.',
  p1080: 'Standard high definition. Recommended for most users.',
  p720: 'Smaller files, plays smoothly on older devices.',
  p480: 'Minimum sensible video quality. Mobile-friendly.',
  audio_mp3: 'Extracts audio and re-encodes to MP3 (192 kbps).',
  audio_m4a: 'Extracts native AAC/M4A without re-encoding when possible.',
};

/**
 * yt-dlp `-f` format selector mirroring the J1.3 server-side mapping.
 * Used by:
 *   - the desktop sidecar adapter (J1.8) when it shells out to yt-dlp directly
 *   - UI code that wants to show the underlying selector for transparency
 */
export function selectorForPreset(preset: QualityPreset): string {
  switch (preset) {
    case 'best':
      return 'bv*+ba/b';
    case 'p2160':
      return 'bv*[height<=2160]+ba/b[height<=2160]';
    case 'p1440':
      return 'bv*[height<=1440]+ba/b[height<=1440]';
    case 'p1080':
      return 'bv*[height<=1080]+ba/b[height<=1080]';
    case 'p720':
      return 'bv*[height<=720]+ba/b[height<=720]';
    case 'p480':
      return 'bv*[height<=480]+ba/b[height<=480]';
    case 'audio_mp3':
      return 'ba/b';
    case 'audio_m4a':
      return 'ba[ext=m4a]/ba/b';
  }
}
