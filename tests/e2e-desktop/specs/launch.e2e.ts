import { browser } from '@wdio/globals';

/**
 * Smoke test: the desktop app launches via tauri-driver and the OS window
 * carries the productName / window title from tauri.conf.json.
 *
 * Reference: apps/desktop/src-tauri/tauri.conf.json
 *   - productName: "Universal Downloader"
 *   - app.windows[0].title: "Universal Downloader by CT4nk3r"
 */
describe('desktop launch', () => {
  it('opens a window whose title contains "Universal Downloader"', async () => {
    // Wait for the webview document to be ready.
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 30_000, timeoutMsg: 'Webview document never reached readyState=complete' },
    );

    const title = await browser.getTitle();
    // eslint-disable-next-line no-console
    console.log(`[launch.e2e] window title = ${JSON.stringify(title)}`);

    if (!title || !title.toLowerCase().includes('universal downloader')) {
      throw new Error(`Expected window title to contain "Universal Downloader", got: ${JSON.stringify(title)}`);
    }
  });

  it('renders the root web app shell', async () => {
    const root = await browser.$('#root, #app, body');
    await root.waitForExist({ timeout: 15_000 });
    const html = await browser.execute(() => document.body.innerHTML.length);
    if (typeof html !== 'number' || html <= 0) {
      throw new Error('Document body appears to be empty after launch');
    }
  });
});
