import { test, expect } from '@playwright/test';
import { useMockGithubApi, MOCK_PR_NUMBER } from './mock-github';

test.describe('auth / settings flow (T085)', () => {
  test('with no PAT stored, Settings panel is open by default on load', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await expect(page.getByTestId('settings-panel')).toBeVisible({ timeout: 5000 });
  });

  test('Save with a 401 response surfaces the scope error banner', async ({ page }) => {
    await useMockGithubApi(page, '401');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await expect(page.getByTestId('settings-panel')).toBeVisible();

    await page.getByTestId('settings-pat-input').fill('github_pat_invalid_token');
    await page.getByTestId('settings-save').click();

    await expect(page.getByText(/Token rejected/)).toBeVisible({ timeout: 5000 });
  });

  test('Save with a valid PAT (200 on PR #1 probe) closes the panel', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await expect(page.getByTestId('settings-panel')).toBeVisible();

    await page.getByTestId('settings-pat-input').fill('github_pat_valid_token');
    await page.getByTestId('settings-save').click();

    await expect(page.getByText(/Token accepted/)).toBeVisible({ timeout: 5000 });
    // Panel closes automatically ~800ms after success.
    await expect(page.getByTestId('settings-panel')).not.toBeVisible({ timeout: 5000 });
  });

  test('Clear wipes storage so next navigation reopens Settings by default', async ({ page }) => {
    // Seed a PAT via the in-app save flow.
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await page.getByTestId('settings-pat-input').fill('github_pat_valid_token');
    await page.getByTestId('settings-save').click();
    await expect(page.getByText(/Token accepted/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('settings-panel')).not.toBeVisible({ timeout: 5000 });

    // Reopen settings and clear.
    await page.getByTestId('settings-toggle').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible();
    await page.getByTestId('settings-clear').click();
    await page.getByTestId('settings-close').click();

    // Reload: without a PAT, settings should open again by default.
    await page.reload();
    await expect(page.getByTestId('settings-panel')).toBeVisible({ timeout: 5000 });
  });
});
