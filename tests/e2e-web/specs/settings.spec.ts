import { test, expect } from '@playwright/test';
import { installApiMocks, seedSettings } from '../fixtures/api-mock';

test.describe('Settings — endpoint URL persistence', () => {
  test('changing the API base URL persists across reloads', async ({ page }) => {
    await installApiMocks(page);
    await seedSettings(page);
    await page.goto('/settings');

    const baseUrlInput = page.getByLabel(/api base url/i);
    await expect(baseUrlInput).toBeVisible();
    await expect(baseUrlInput).toHaveValue('http://localhost:8787/v1');

    await baseUrlInput.fill('http://api.example.test/v2');

    // The settings store writes through to localStorage on each change.
    await expect
      .poll(async () =>
        await page.evaluate(() => window.localStorage.getItem('ud-settings') ?? ''),
      )
      .toContain('api.example.test');

    // Survives a full reload.
    await page.reload();
    await expect(page.getByLabel(/api base url/i)).toHaveValue(
      'http://api.example.test/v2',
    );
  });

  test('default preset selection persists', async ({ page }) => {
    await installApiMocks(page);
    await seedSettings(page);
    await page.goto('/settings');

    const presetSelect = page.getByLabel(/default preset/i);
    await expect(presetSelect).toBeVisible();
    await presetSelect.selectOption({ label: '720p' });

    await page.reload();
    await expect(page.getByLabel(/default preset/i)).toHaveValue('p720');
  });

  test('theme switcher persists the chosen theme', async ({ page }) => {
    await installApiMocks(page);
    await seedSettings(page, { theme: 'system' });
    await page.goto('/settings');

    // The Settings screen renders the theme buttons inside a radiogroup
    // labelled "Theme".
    const themeGroup = page.getByRole('radiogroup', { name: /theme/i });
    await themeGroup.getByRole('radio', { name: /^dark$/i }).click();

    await expect
      .poll(async () =>
        await page.evaluate(() => window.localStorage.getItem('ud-settings') ?? ''),
      )
      .toContain('"theme":"dark"');
  });
});
