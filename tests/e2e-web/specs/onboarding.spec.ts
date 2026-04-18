import { test, expect } from '@playwright/test';
import { installApiMocks, seedSettings } from '../fixtures/api-mock';

test.describe('Onboarding — API key gate', () => {
  test('shows the gate when no API key is configured', async ({ page }) => {
    await installApiMocks(page);
    // No `seedSettings` here: localStorage is empty, app must show the gate
    // on protected routes.
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /api key required/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /open settings/i })).toBeVisible();

    // Following the CTA lands on /settings.
    await page.getByRole('link', { name: /open settings/i }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('saving an API key on Settings unlocks the home screen', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/settings');

    // The API key field is a labelled <input>.
    const keyField = page.getByLabel(/api key/i, { exact: false }).first();
    await expect(keyField).toBeVisible();
    await keyField.fill('my-secret-key-123');

    // Settings store persists on change. Reload to prove it stuck.
    await page.reload();
    await expect(keyField).toHaveValue('my-secret-key-123');

    // Now the home screen no longer shows the gate.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /api key required/i })).toHaveCount(0);
    await expect(page.getByLabel(/video url/i)).toBeVisible();
  });

  test('Test connection button reports success against a healthy backend', async ({ page }) => {
    await installApiMocks(page);
    await seedSettings(page);
    await page.goto('/settings');

    await page.getByRole('button', { name: /test connection/i }).click();

    // Status region announces "Connected" once /healthz resolves.
    await expect(page.getByRole('status')).toContainText(/connected/i);
  });
});
