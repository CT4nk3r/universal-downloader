/**
 * Helpers for loading shared test fixtures from TypeScript tests
 * (vitest, playwright, etc.).
 *
 * Mirrors the public API of `loaders.py` so behaviour stays consistent
 * across language ecosystems.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
export const FIXTURES_DIR = dirname(__filename);

const SAMPLE_MP4 = resolve(FIXTURES_DIR, "sample.mp4");
const SAMPLE_METADATA = resolve(FIXTURES_DIR, "sample_metadata.json");

export class FixtureMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FixtureMissingError";
  }
}

export interface SampleFormat {
  format_id: string;
  ext: string;
  acodec: string;
  vcodec: string;
  width?: number;
  height?: number;
  fps?: number;
  abr?: number;
  tbr?: number;
  filesize?: number;
  url: string;
}

export interface SampleMetadata {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  formats: SampleFormat[];
  [key: string]: unknown;
}

/** Load the synthetic yt-dlp `info_dict` used by offline tests. */
export function loadSampleMetadata(): SampleMetadata {
  if (!existsSync(SAMPLE_METADATA)) {
    throw new FixtureMissingError(
      `sample_metadata.json missing at ${SAMPLE_METADATA}. ` +
        "The fixtures directory appears to be corrupt.",
    );
  }
  const raw = readFileSync(SAMPLE_METADATA, "utf-8");
  return JSON.parse(raw) as SampleMetadata;
}

/**
 * Return the absolute path to `sample.mp4`.
 *
 * The MP4 itself is not committed (see `tests/fixtures/README.md`).
 * If a maintainer has not provided one, throw a clear error instead of
 * letting downstream tooling fail with a cryptic message.
 */
export function sampleMp4Path(): string {
  if (!existsSync(SAMPLE_MP4) || statSync(SAMPLE_MP4).size === 0) {
    throw new FixtureMissingError(
      `Required fixture missing: ${SAMPLE_MP4}\n` +
        "Place a small public-domain MP4 at this path before running " +
        "integration tests. See tests/fixtures/README.md for a curl " +
        "command that fetches Big Buck Bunny from archive.org.",
    );
  }
  return SAMPLE_MP4;
}

/** Return an absolute path to an arbitrary fixture file by name. */
export function fixturePath(name: string): string {
  const p = resolve(FIXTURES_DIR, name);
  if (!existsSync(p)) {
    throw new FixtureMissingError(`Fixture not found: ${p}`);
  }
  return p;
}
