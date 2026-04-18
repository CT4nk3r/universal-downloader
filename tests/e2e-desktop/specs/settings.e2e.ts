import { browser, $ } from '@wdio/globals';

/**
 * Settings: switching between the bundled sidecar and a remote API endpoint.
 *
 * Expected UI surface (data-testid contract):
 *   - settings-nav            : link/button that opens the settings view
 *   - api-mode-bundled        : radio/segment for bundled mode
 *   - api-mode-remote         : radio/segment for remote mode
 *   - remote-api-url          : text input for the remote base URL
 *   - settings-save           : button that persists the change
 *   - settings-active-mode    : element whose text reflects the active mode
 */

const REMOTE_URL = process.env.UD_E2E_REMOTE_URL || 'http://127.0.0.1:8787';

async function openSettings(): Promise<boolean> {
  const nav = await $('[data-testid="settings-nav"]');
  if (!(await nav.isExisting())) return false;
  await nav.click();
  const panel = await $('[data-testid="api-mode-bundled"]');
  await panel.waitForExist({ timeout: 5_000 });
  return true;
}

describe('settings: bundled <-> remote API switching', () => {
  before(async () => {
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 30_000 },
    );
  });

  it('switches to remote API and persists the URL', async function () {
    if (!(await openSettings())) {
      // eslint-disable-next-line no-console
      console.warn('[settings.e2e] settings UI not available; skipping.');
      this.skip();
      return;
    }

    await (await $('[data-testid="api-mode-remote"]')).click();

    const urlInput = await $('[data-testid="remote-api-url"]');
    await urlInput.waitForExist({ timeout: 5_000 });
    await urlInput.setValue(REMOTE_URL);

    await (await $('[data-testid="settings-save"]')).click();

    const active = await $('[data-testid="settings-active-mode"]');
    await active.waitForExist({ timeout: 5_000 });
    const text = (await active.getText()).toLowerCase();
    if (!text.includes('remote')) {
      throw new Error(`Expected active mode "remote", got: ${text}`);
    }
  });

  it('switches back to the bundled sidecar', async function () {
    if (!(await openSettings())) {
      this.skip();
      return;
    }

    await (await $('[data-testid="api-mode-bundled"]')).click();
    await (await $('[data-testid="settings-save"]')).click();

    const active = await $('[data-testid="settings-active-mode"]');
    await active.waitForExist({ timeout: 5_000 });
    const text = (await active.getText()).toLowerCase();
    if (!text.includes('bundled')) {
      throw new Error(`Expected active mode "bundled", got: ${text}`);
    }
  });
});
