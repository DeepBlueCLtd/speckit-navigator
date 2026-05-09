import { test, expect } from '@playwright/test';
import {
  useMockGithubApi,
  seedPat,
  MOCK_PR_NUMBER,
} from './mock-github';

async function addFeatureComment(page: import('@playwright/test').Page, body: string): Promise<void> {
  await page.getByTestId('comment-feature-button').click();
  await page.getByTestId('composer-body').fill(body);
  await page.getByTestId('composer-save').click();
}

test.describe('drafts drawer lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await seedPat(page);
  });

  test('draft three comments, reload, all three persist (FR-021)', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await expect(page.getByTestId('markdown-body')).toBeVisible({ timeout: 15000 });

    await addFeatureComment(page, 'First draft.');
    await addFeatureComment(page, 'Second draft.');
    await addFeatureComment(page, 'Third draft.');

    await expect(page.getByText('First draft.')).toBeVisible();
    await expect(page.getByText('Second draft.')).toBeVisible();
    await expect(page.getByText('Third draft.')).toBeVisible();

    await page.reload();
    await expect(page.getByText('First draft.')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Second draft.')).toBeVisible();
    await expect(page.getByText('Third draft.')).toBeVisible();
  });

  test('Edit round-trip updates the visible body', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await expect(page.getByTestId('markdown-body')).toBeVisible({ timeout: 15000 });

    await addFeatureComment(page, 'Original body.');
    const entries = page.locator('[data-testid^="drawer-entry-"]');
    const entryId = await entries.first().getAttribute('data-testid');
    const commentId = entryId!.replace('drawer-entry-', '');

    await page.getByTestId(`drawer-edit-${commentId}`).click();
    await page.getByTestId('composer-body').fill('Revised body.');
    await page.getByTestId('composer-save').click();

    await expect(page.getByText('Revised body.')).toBeVisible();
    await expect(page.getByText('Original body.')).not.toBeVisible();
  });

  test('Delete with confirmation removes the comment', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await expect(page.getByTestId('markdown-body')).toBeVisible({ timeout: 15000 });

    await addFeatureComment(page, 'Will be deleted.');
    const entryId = await page
      .locator('[data-testid^="drawer-entry-"]')
      .first()
      .getAttribute('data-testid');
    const commentId = entryId!.replace('drawer-entry-', '');

    await page.getByTestId(`drawer-delete-${commentId}`).click();
    await page.getByTestId(`drawer-delete-confirm-${commentId}`).click();
    await expect(page.getByText('Will be deleted.')).not.toBeVisible();
  });

  test('Clear all with confirmation empties the drawer', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await expect(page.getByTestId('markdown-body')).toBeVisible({ timeout: 15000 });

    await addFeatureComment(page, 'One.');
    await addFeatureComment(page, 'Two.');

    await page.getByTestId('drawer-clear-all').click();
    await page.getByTestId('drawer-clear-confirm').click();
    await expect(page.getByText(/No drafts yet/)).toBeVisible();
  });

  test('successful submit leaves the drawer empty after reload (FR-022)', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await expect(page.getByTestId('markdown-body')).toBeVisible({ timeout: 15000 });

    await addFeatureComment(page, 'About to be submitted.');
    await page.getByTestId('submit-button').click();
    await expect(page.getByTestId('submit-success')).toBeVisible({ timeout: 10000 });

    await page.reload();
    await expect(page.getByText(/No drafts yet/)).toBeVisible({ timeout: 15000 });
  });
});
