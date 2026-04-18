import { describe, expect, it } from 'vitest';
import { defaultFilenameTemplate, sanitizeFilename } from '../filename.js';

describe('sanitizeFilename', () => {
  it('returns _ for empty input', () => {
    expect(sanitizeFilename('')).toBe('_');
    expect(sanitizeFilename('   ')).toBe('_');
    expect(sanitizeFilename('...')).toBe('_');
  });
  it('strips invalid chars', () => {
    expect(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });
  it('strips control chars', () => {
    expect(sanitizeFilename('hello\x00world\x1F')).toBe('hello_world_');
  });
  it('collapses whitespace', () => {
    expect(sanitizeFilename('hello   world\t\nfoo')).toBe('hello world foo');
  });
  it('trims leading/trailing dots and spaces', () => {
    expect(sanitizeFilename('  ..hello..  ')).toBe('hello');
  });
  it('keeps unicode', () => {
    expect(sanitizeFilename('héllo wörld 你好 🎉')).toBe('héllo wörld 你好 🎉');
  });
  it('truncates by graphemes', () => {
    const long = 'a'.repeat(500);
    expect(sanitizeFilename(long, 50)).toHaveLength(50);
  });
  it('does not split surrogate pairs when truncating', () => {
    const emoji = '🎉'.repeat(20);
    const out = sanitizeFilename(emoji, 5);
    // Each 🎉 is one grapheme; result should contain exactly 5 of them.
    const segs = Array.from(out);
    // Array.from splits by code point, 🎉 is one code point.
    expect(segs.length).toBe(5);
  });
  it('escapes Windows reserved device names', () => {
    expect(sanitizeFilename('CON')).toBe('_CON');
    expect(sanitizeFilename('NUL.txt')).toBe('_NUL.txt');
  });
  it('handles very long unicode', () => {
    const s = '日本語'.repeat(1000);
    expect(sanitizeFilename(s, 100).length).toBeLessThanOrEqual(100);
  });
  it('exposes default template', () => {
    expect(defaultFilenameTemplate).toBe('%(title)s [%(id)s].%(ext)s');
  });
});
