/**
 * Filename helpers. Cross-platform (Win/macOS/Linux) safe.
 */

// Windows reserved characters: <>:"/\|?* plus control chars 0x00–0x1F.
// Also strip leading/trailing dots & spaces (Windows quirk).
const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;
const RESERVED_WINDOWS = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

/**
 * Count user-perceived characters (graphemes) when available, falling back
 * to UTF-16 code-unit length. Used for `maxLen` truncation so we don't
 * split surrogate pairs or combining sequences.
 */
function graphemes(s: string): string[] {
  const Seg = (globalThis as { Intl?: { Segmenter?: typeof Intl.Segmenter } }).Intl?.Segmenter;
  if (typeof Seg === 'function') {
    try {
      const seg = new Seg(undefined, { granularity: 'grapheme' });
      return Array.from(seg.segment(s), (x) => x.segment);
    } catch {
      /* fall through */
    }
  }
  return Array.from(s);
}

/**
 * Sanitise a string for safe use as a filename across all major platforms.
 * Keeps unicode letters, replaces invalid chars with `_`, collapses
 * whitespace, strips leading/trailing dots & spaces, and truncates to
 * `maxLen` graphemes (default 200).
 *
 * Returns `"_"` for empty / fully-invalid input so callers always get a
 * usable name.
 */
export function sanitizeFilename(name: string, maxLen = 200): string {
  // Collapse whitespace (incl. tabs/newlines) first so control-char
  // replacement below doesn't turn them into underscores.
  let out = String(name).normalize('NFC').replace(/\s+/g, ' ');
  out = out.replace(INVALID_CHARS, '_').trim();
  out = out.replace(/^[.\s]+|[.\s]+$/g, '');

  if (out === '') return '_';

  // Reserved Windows device names → suffix underscore so the *base* differs.
  const baseUpper = out.split('.')[0]?.toUpperCase() ?? '';
  if (RESERVED_WINDOWS.has(baseUpper)) {
    out = `_${out}`;
  }

  if (maxLen > 0) {
    const gs = graphemes(out);
    if (gs.length > maxLen) {
      out = gs.slice(0, maxLen).join('').trimEnd();
    }
  }

  return out === '' ? '_' : out;
}

/** Default yt-dlp output template used by all clients. */
export const defaultFilenameTemplate = '%(title)s [%(id)s].%(ext)s';
