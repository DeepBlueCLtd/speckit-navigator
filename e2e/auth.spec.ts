import { test, expect } from '@playwright/test';
import { useMockGithubApi, MOCK_PR_NUMBER } from './mock-github';

test.describe('auth / settings flow (read-only by default)', () => {
  test('with no PAT stored, the app loads read-only and shows the hint, not the Settings panel', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    // Read-only hint is visible
    await expect(page.getByTestId('read-only-hint')).toBeVisible({ timeout: 5000 });
    // Settings is NOT auto-opened
    await expect(page.getByTestId('settings-panel')).not.toBeVisible();
    // Copy-feedback button takes the place of Submit when no PAT
    await expect(page.getByTestId('copy-feedback-button')).toBeVisible();
  });

  test('dismissing the read-only hint persists across reloads', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await page.getByTestId('read-only-hint-dismiss').click();
    await expect(page.getByTestId('read-only-hint')).not.toBeVisible();
    await page.reload();
    await expect(page.getByTestId('read-only-hint')).not.toBeVisible({ timeout: 5000 });
  });

  test('opening Settings and saving a valid PAT closes the panel and swaps Copy button for Submit', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await page.getByTestId('settings-toggle').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible();

    await page.getByTestId('settings-pat-input').fill('github_pat_valid_token');
    await page.getByTestId('settings-save').click();

    await expect(page.getByText(/Token accepted/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('settings-panel')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('submit-button')).toBeVisible();
    await expect(page.getByTestId('copy-feedback-button')).not.toBeVisible();
  });

  test('Save with a 401 response surfaces the scope error banner', async ({ page }) => {
    await useMockGithubApi(page, '401');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await page.getByTestId('settings-toggle').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible();

    await page.getByTestId('settings-pat-input').fill('github_pat_invalid_token');
    await page.getByTestId('settings-save').click();

    await expect(page.getByText(/Token rejected/)).toBeVisible({ timeout: 5000 });
  });

  test('Clear wipes storage so reloading returns to read-only mode', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await page.getByTestId('settings-toggle').click();
    await page.getByTestId('settings-pat-input').fill('github_pat_valid_token');
    await page.getByTestId('settings-save').click();
    await expect(page.getByText(/Token accepted/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('settings-panel')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('submit-button')).toBeVisible();

    await page.getByTestId('settings-toggle').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible();
    await page.getByTestId('settings-clear').click();
    await page.getByTestId('settings-close').click();

    await page.reload();
    // After clearing: copy-feedback is back, no auto-opened Settings.
    await expect(page.getByTestId('copy-feedback-button')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('settings-panel')).not.toBeVisible();
  });
});
