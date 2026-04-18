/**
 * Maps the user-facing settings preset (`audio-mp3`, `video-1080p`, etc.) to
 * the API's `QualityPreset` enum from `@universal-downloader/shared-types`.
 */
import type { QualityPreset } from '@universal-downloader/shared-types';
import type { DownloadPreset } from '../lib/settings-store';

export function presetFromSettings(p: DownloadPreset | undefined): QualityPreset {
  switch (p) {
    case 'audio-mp3':
      return 'audio_mp3';
    case 'audio-flac':
      return 'audio_m4a'; // shared-types has no flac; closest lossless-ish slot
    case 'video-1080p':
      return 'p1080';
    case 'video-best':
    default:
      return 'best';
  }
}

export function isAudioPreset(p: QualityPreset): boolean {
  return p === 'audio_mp3' || p === 'audio_m4a';
}
