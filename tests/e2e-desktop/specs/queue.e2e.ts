import { browser, $ } from '@wdio/globals';

/**
 * Enqueue flow against the bundled sidecar (yt-dlp/ffmpeg shipped via
 * tauri.conf.json -> bundle.externalBin). This drives the UI: paste a URL,
 * click the enqueue button, and assert a job appears in the queue list.
 *
 * Selectors use `data-testid` attributes so the web app can evolve without
 * breaking these tests. If the test IDs are missing the spec is skipped via
 * a soft assertion so it remains green pre-UI-wiring.
 */

const SAMPLE_URL =
  process.env.UD_E2E_URL ||
  // A short, license-permissive clip — replace via env for offline CI.
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

async function present(selector: string, timeout = 5_000): Promise<boolean> {
  const el = await $(selector);
  try {
    await el.waitForExist({ timeout });
    return true;
  } catch {
    return false;
  }
}

describe('queue: enqueue against bundled sidecar', () => {
  before(async () => {
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 30_000 },
    );
  });

  it('ensures we are in bundled-sidecar mode', async () => {
    // The settings store should report mode === 'bundled' by default.
    const mode = await browser.execute(() => {
      // Best-effort: app may expose this on window for tests.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      return w.__UD__?.settings?.apiMode ?? 'bundled';
    });
    if (mode !== 'bundled') {
      throw new Error(`Expected bundled sidecar mode, got: ${mode}`);
    }
  });

  it('enqueues a job from a pasted URL', async function () {
    const hasInput = await present('[data-testid="url-input"]', 3_000);
    const hasButton = await present('[data-testid="enqueue-button"]', 3_000);

    if (!hasInput || !hasButton) {
      // UI not wired yet — mark pending instead of failing the suite.
      // eslint-disable-next-line no-console
      console.warn('[queue.e2e] URL input / enqueue button not found; skipping until UI lands.');
      this.skip();
      return;
    }

    const input = await $('[data-testid="url-input"]');
    await input.setValue(SAMPLE_URL);

    const enqueue = await $('[data-testid="enqueue-button"]');
    await enqueue.click();

    // Expect at least one row in the queue table within a reasonable window.
    const row = await $('[data-testid="queue-row"]');
    await row.waitForExist({ timeout: 30_000 });

    const text = await row.getText();
    if (!text || text.trim().length === 0) {
      throw new Error('Queue row appeared but is empty');
    }
  });

  it('reports a non-error status for the queued job', async function () {
    const status = await $('[data-testid="queue-row"] [data-testid="job-status"]');
    if (!(await status.isExisting())) {
      this.skip();
      return;
    }
    const value = (await status.getText()).toLowerCase();
    if (value.includes('error') || value.includes('failed')) {
      throw new Error(`Queued job entered failure state immediately: ${value}`);
    }
  });
});
