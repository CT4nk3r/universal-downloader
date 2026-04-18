import type { SiteId } from '@universal-downloader/shared-types';

const TRACKING_PARAM_PREFIXES = ['utm_'];
const TRACKING_PARAMS_EXACT = new Set(['fbclid', 'gclid', 'si', 'feature']);

/**
 * Normalise a user-provided URL string:
 *   - trim whitespace
 *   - prepend `https://` if no scheme is present
 *   - strip common tracking params (utm_*, fbclid, gclid, si, feature)
 *
 * Invalid input is returned as-is (after trimming + scheme prepend) so callers
 * can let validation happen elsewhere.
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') return '';

  const withScheme = /^[a-z][a-z0-9+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return withScheme;
  }

  const toDelete: string[] = [];
  parsed.searchParams.forEach((_v, k) => {
    const lower = k.toLowerCase();
    if (TRACKING_PARAMS_EXACT.has(lower)) {
      toDelete.push(k);
      return;
    }
    if (TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p))) {
      toDelete.push(k);
    }
  });
  for (const k of toDelete) parsed.searchParams.delete(k);

  // Drop trailing `?` if no params remain
  let out = parsed.toString();
  if (parsed.searchParams.toString() === '') {
    out = out.replace(/\?(?=#|$)/, '');
  }
  return out;
}

const YT_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;
const NUMERIC_ID_RE = /^[0-9]{3,}$/;
const REDDIT_ID_RE = /^[A-Za-z0-9]{4,16}$/;

/**
 * Extract a site-native video/post id from a URL. Returns `null` if no id
 * could be confidently extracted for the given site.
 */
export function extractVideoId(url: string, site: SiteId): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const segments = parsed.pathname.split('/').filter(Boolean);

  switch (site) {
    case 'youtube': {
      if (host === 'youtu.be') {
        const id = segments[0];
        return id && YT_ID_RE.test(id) ? id : null;
      }
      const v = parsed.searchParams.get('v');
      if (v && YT_ID_RE.test(v)) return v;
      const idx = segments.findIndex((s) => s === 'shorts' || s === 'embed' || s === 'live');
      if (idx >= 0) {
        const id = segments[idx + 1];
        if (id && YT_ID_RE.test(id)) return id;
      }
      return null;
    }
    case 'x': {
      // x.com/<user>/status/<id> or twitter.com/i/web/status/<id>
      const statusIdx = segments.findIndex((s) => s === 'status' || s === 'statuses');
      if (statusIdx >= 0) {
        const id = segments[statusIdx + 1];
        if (id && NUMERIC_ID_RE.test(id)) return id;
      }
      return null;
    }
    case 'facebook': {
      if (host === 'fb.watch') {
        const id = segments[0];
        return id ?? null;
      }
      // facebook.com/watch/?v=<id>
      const v = parsed.searchParams.get('v');
      if (v && NUMERIC_ID_RE.test(v)) return v;
      // facebook.com/<user>/videos/<id>
      const vidsIdx = segments.findIndex((s) => s === 'videos' || s === 'reel');
      if (vidsIdx >= 0) {
        const id = segments[vidsIdx + 1];
        if (id && NUMERIC_ID_RE.test(id)) return id;
      }
      return null;
    }
    case 'reddit': {
      if (host === 'redd.it' || host === 'v.redd.it') {
        const id = segments[0];
        return id && REDDIT_ID_RE.test(id) ? id : null;
      }
      const cIdx = segments.findIndex((s) => s === 'comments');
      if (cIdx >= 0) {
        const id = segments[cIdx + 1];
        if (id && REDDIT_ID_RE.test(id)) return id;
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Heuristic check: does this URL look like a playlist / album / channel feed?
 * Used to warn before accidentally enqueueing thousands of items.
 */
export function isLikelyPlaylist(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.searchParams.has('list')) return true;
  const path = parsed.pathname.toLowerCase();
  const playlistSegments = [
    '/playlist',
    '/playlists',
    '/album',
    '/sets/',
    '/channel/',
    '/c/',
    '/user/',
    '/@',
  ];
  return playlistSegments.some((seg) => path.includes(seg));
}
