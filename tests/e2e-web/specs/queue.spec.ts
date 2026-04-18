import { test, expect } from '@playwright/test';
import { installApiMocks, seedSettings } from '../fixtures/api-mock';

const SAMPLE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

test.describe('Queue — paste URL → preset → enqueue → progress → done', () => {
  test.beforeEach(async ({ page }) => {
    await seedSettings(page);
  });

  test('enqueues a download from a pasted URL using a preset', async ({ page }) => {
    const mocks = await installApiMocks(page, { seed: [] });

    await page.goto('/');

    // 1) Type the URL (clipboard.readText is unreliable across browsers in CI,
    //    so we type into the visible input rather than clicking "Paste").
    const urlInput = page.getByLabel(/video url/i);
    await expect(urlInput).toBeVisible();
    await urlInput.fill(SAMPLE_URL);

    // 2) Probe.
    await page.getByRole('button', { name: /^probe$/i }).click();

    // ProbeCard renders the title once /v1/probe resolves.
    await expect(
      page.getByText(/never gonna give you up/i).first(),
    ).toBeVisible();

    // 3) Pick a preset chip — "1080p MP4" is in the visible CHIPS row.
    await page.getByRole('radio', { name: /1080p mp4/i }).click();
    await expect(page.getByRole('radio', { name: /1080p mp4/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // 4) Enqueue.
    await page.getByRole('button', { name: /^download$/i }).click();

    // 5) Active queue surfaces a row + a progressbar.
    const queueRegion = page.getByRole('region', { name: /active downloads/i });
    await expect(queueRegion).toBeVisible();
    await expect(queueRegion.getByRole('progressbar')).toHaveCount(1, {
      timeout: 7_000,
    });

    // 6) Server flips the job to "ready"; the polled GET /jobs picks it up.
    const created = mocks.state.jobs[0];
    expect(created).toBeTruthy();
    mocks.markReady(created!.id);

    // The History view is the canonical "done card" location — assert it
    // appears there once terminal.
    await page.goto('/history');
    await expect(
      page.getByRole('listitem').filter({ hasText: /never gonna give you up/i }),
    ).toBeVisible({ timeout: 7_000 });
  });

  test('shows the empty state when the queue has no active jobs', async ({ page }) => {
    await installApiMocks(page, { seed: [] });
    await page.goto('/');

    await expect(page.getByText(/no active downloads/i)).toBeVisible();
  });
});
