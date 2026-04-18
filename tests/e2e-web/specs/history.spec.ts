import { test, expect } from '@playwright/test';
import { DEFAULT_HISTORY, installApiMocks, seedSettings } from '../fixtures/api-mock';

test.describe('History — search, filter, redownload', () => {
  test.beforeEach(async ({ page }) => {
    await seedSettings(page);
  });

  test('lists only terminal jobs (filtered from active queue)', async ({ page }) => {
    await installApiMocks(page, {
      seed: [
        ...DEFAULT_HISTORY,
        // Active job — should NOT show on history page.
        {
          id: 'job-active-1',
          url: 'https://example.com/active',
          title: 'Currently downloading',
          site: null,
          status: 'downloading',
          thumbnail: null,
          preset: 'best',
          created_at: '2026-04-15T10:00:00.000Z',
          updated_at: '2026-04-15T10:00:30.000Z',
          progress: { percent: 42 },
          error: null,
        },
      ],
    });
    await page.goto('/history');

    // Both ready entries are visible.
    await expect(page.getByText(/rickroll-d \(archive\)/i)).toBeVisible();
    await expect(page.getByText(/sintel teaser/i)).toBeVisible();
    // Failed entry is also a terminal status — should be visible.
    await expect(page.getByText(/broken upload/i)).toBeVisible();
    // Non-terminal job is filtered out.
    await expect(page.getByText(/currently downloading/i)).toHaveCount(0);
  });

  test('search box narrows the list by title and URL substring', async ({ page }) => {
    await installApiMocks(page, { seed: DEFAULT_HISTORY });
    await page.goto('/history');

    const search = page.getByRole('searchbox');
    await expect(search).toBeVisible();

    await search.fill('sintel');
    await expect(page.getByText(/sintel teaser/i)).toBeVisible();
    await expect(page.getByText(/rickroll-d/i)).toHaveCount(0);

    // URL substring matching.
    await search.fill('vimeo.com');
    await expect(page.getByText(/sintel teaser/i)).toBeVisible();
    await expect(page.getByText(/broken upload/i)).toHaveCount(0);

    // Clear restores everything.
    await search.fill('');
    await expect(page.getByText(/rickroll-d/i)).toBeVisible();
    await expect(page.getByText(/sintel teaser/i)).toBeVisible();
  });

  test('Re-download enqueues a new job from a history entry', async ({ page }) => {
    const mocks = await installApiMocks(page, { seed: DEFAULT_HISTORY });
    await page.goto('/history');

    const sintelRow = page.getByRole('listitem').filter({ hasText: /sintel teaser/i });
    await expect(sintelRow).toBeVisible();
    await sintelRow.getByRole('button', { name: /re-download/i }).click();

    // The mock store should have grown by one — the most recent entry should
    // point at the same source URL.
    await expect.poll(() => mocks.state.jobs.length).toBeGreaterThan(DEFAULT_HISTORY.length);
    const latest = mocks.state.jobs[0]!;
    expect(latest.url).toBe('https://vimeo.com/123456789');
  });
});
