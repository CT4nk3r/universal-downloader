import { describe, expect, it } from 'vitest';
import { extractVideoId, isLikelyPlaylist, normalizeUrl } from '../url.js';

describe('normalizeUrl', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl('   ')).toBe('');
  });

  it('trims whitespace', () => {
    expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com/');
  });

  it('prepends https:// when scheme is missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
    expect(normalizeUrl('youtu.be/abc12345')).toBe('https://youtu.be/abc12345');
  });

  it('keeps existing scheme', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com/');
    expect(normalizeUrl('ftp://example.com/x')).toBe('ftp://example.com/x');
  });

  it('strips utm_* tracking params', () => {
    expect(
      normalizeUrl('https://x.com/a?utm_source=foo&utm_medium=bar&keep=1'),
    ).toBe('https://x.com/a?keep=1');
  });

  it('strips fbclid, gclid, si, feature', () => {
    expect(normalizeUrl('https://example.com/?fbclid=1&gclid=2&si=3&feature=4')).toBe(
      'https://example.com/',
    );
  });

  it('preserves non-tracking params', () => {
    expect(normalizeUrl('https://youtube.com/watch?v=abc12345&t=10')).toBe(
      'https://youtube.com/watch?v=abc12345&t=10',
    );
  });

  it('is case-insensitive on tracking param names', () => {
    expect(normalizeUrl('https://example.com/?UTM_Source=x&FBCLID=y')).toBe(
      'https://example.com/',
    );
  });

  it('returns input with scheme on malformed URL', () => {
    const out = normalizeUrl('not a url at all');
    expect(out.startsWith('https://')).toBe(true);
  });
});

describe('extractVideoId — youtube', () => {
  it('handles youtu.be short links', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ', 'youtube')).toBe('dQw4w9WgXcQ');
  });
  it('handles /watch?v=', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1', 'youtube')).toBe(
      'dQw4w9WgXcQ',
    );
  });
  it('handles /shorts/', () => {
    expect(extractVideoId('https://www.youtube.com/shorts/abcDEF12345', 'youtube')).toBe(
      'abcDEF12345',
    );
  });
  it('handles /embed/ and /live/', () => {
    expect(extractVideoId('https://www.youtube.com/embed/abcDEF12345', 'youtube')).toBe(
      'abcDEF12345',
    );
    expect(extractVideoId('https://www.youtube.com/live/abcDEF12345', 'youtube')).toBe(
      'abcDEF12345',
    );
  });
  it('returns null when no id', () => {
    expect(extractVideoId('https://www.youtube.com/', 'youtube')).toBeNull();
    expect(extractVideoId('not a url', 'youtube')).toBeNull();
  });
});

describe('extractVideoId — x', () => {
  it('handles x.com/<user>/status/<id>', () => {
    expect(extractVideoId('https://x.com/jack/status/1234567890', 'x')).toBe('1234567890');
  });
  it('handles twitter.com', () => {
    expect(
      extractVideoId('https://twitter.com/jack/status/1234567890?s=20', 'x'),
    ).toBe('1234567890');
  });
  it('returns null without status segment', () => {
    expect(extractVideoId('https://x.com/jack', 'x')).toBeNull();
  });
});

describe('extractVideoId — facebook', () => {
  it('handles fb.watch short link', () => {
    expect(extractVideoId('https://fb.watch/abc123', 'facebook')).toBe('abc123');
  });
  it('handles facebook.com/watch?v=', () => {
    expect(
      extractVideoId('https://facebook.com/watch/?v=1234567890', 'facebook'),
    ).toBe('1234567890');
  });
  it('handles /videos/<id>', () => {
    expect(
      extractVideoId('https://www.facebook.com/someuser/videos/1234567890', 'facebook'),
    ).toBe('1234567890');
  });
});

describe('extractVideoId — reddit', () => {
  it('handles redd.it short link', () => {
    expect(extractVideoId('https://redd.it/abc123', 'reddit')).toBe('abc123');
  });
  it('handles /comments/<id>', () => {
    expect(
      extractVideoId('https://www.reddit.com/r/videos/comments/abc123/title/', 'reddit'),
    ).toBe('abc123');
  });
  it('returns null on bare reddit link', () => {
    expect(extractVideoId('https://www.reddit.com/r/videos/', 'reddit')).toBeNull();
  });
});

describe('isLikelyPlaylist', () => {
  it('detects ?list=', () => {
    expect(isLikelyPlaylist('https://youtube.com/watch?v=x&list=PL123')).toBe(true);
  });
  it('detects /playlist path', () => {
    expect(isLikelyPlaylist('https://example.com/playlist/xyz')).toBe(true);
  });
  it('detects channel-like paths', () => {
    expect(isLikelyPlaylist('https://www.youtube.com/@SomeChannel')).toBe(true);
    expect(isLikelyPlaylist('https://www.youtube.com/c/SomeChannel')).toBe(true);
  });
  it('returns false for plain video', () => {
    expect(isLikelyPlaylist('https://youtu.be/abc12345')).toBe(false);
  });
  it('returns false on malformed url', () => {
    expect(isLikelyPlaylist('nope')).toBe(false);
  });
});
