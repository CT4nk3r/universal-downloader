import { describe, expect, it } from 'vitest';
import { PRESET_DESCRIPTIONS, PRESET_LABELS, selectorForPreset } from '../presets.js';
import type { QualityPreset } from '@universal-downloader/shared-types';

const ALL_PRESETS: QualityPreset[] = [
  'best',
  'p2160',
  'p1440',
  'p1080',
  'p720',
  'p480',
  'audio_mp3',
  'audio_m4a',
];

describe('preset metadata', () => {
  it('has a label for every preset', () => {
    for (const p of ALL_PRESETS) {
      expect(PRESET_LABELS[p]).toBeTruthy();
      expect(typeof PRESET_LABELS[p]).toBe('string');
    }
  });
  it('has a description for every preset', () => {
    for (const p of ALL_PRESETS) {
      expect(PRESET_DESCRIPTIONS[p]).toBeTruthy();
    }
  });
});

describe('selectorForPreset', () => {
  it('returns best for `best`', () => {
    expect(selectorForPreset('best')).toBe('bv*+ba/b');
  });
  it('caps height for video presets', () => {
    expect(selectorForPreset('p2160')).toContain('height<=2160');
    expect(selectorForPreset('p1440')).toContain('height<=1440');
    expect(selectorForPreset('p1080')).toContain('height<=1080');
    expect(selectorForPreset('p720')).toContain('height<=720');
    expect(selectorForPreset('p480')).toContain('height<=480');
  });
  it('returns audio-only selectors', () => {
    expect(selectorForPreset('audio_mp3')).toBe('ba/b');
    expect(selectorForPreset('audio_m4a')).toContain('m4a');
  });
  it('returns a non-empty string for every preset', () => {
    for (const p of ALL_PRESETS) {
      const sel = selectorForPreset(p);
      expect(sel.length).toBeGreaterThan(0);
    }
  });
});
