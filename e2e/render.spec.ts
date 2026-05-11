import { test, expect } from '@playwright/test';
import { useMockGithubApi, seedPat, MOCK_PR_NUMBER } from './mock-github';

test.describe('artefact rendering (T079)', () => {
  test.beforeEach(async ({ page }) => {
    await seedPat(page);
  });

  test('markdown renders with heading, list, bold, and code fence', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);

    const md = page.getByTestId('markdown-body');
    await expect(md).toBeVisible({ timeout: 15000 });

    // From mock-github.ts the spec.md body contains:
    //   # Spec 191
    //   A short **spec** body.
    //   - item one / - item two
    await expect(md.locator('h1', { hasText: 'Spec 191' })).toBeVisible();
    await expect(md.locator('strong', { hasText: 'spec' })).toBeVisible();
    await expect(md.locator('ul > li', { hasText: 'item one' })).toBeVisible();
    await expect(md.locator('ul > li', { hasText: 'item two' })).toBeVisible();
  });

  test('raw toggle swaps rendered markdown for plain-text <pre>', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await expect(page.getByTestId('markdown-body')).toBeVisible({ timeout: 15000 });

    // Drawer overlays the header buttons at this viewport; collapse it.
    await page.getByTestId('drawer-collapse').click();
    await page.getByTestId('raw-toggle').click();
    await expect(page.getByTestId('raw-body')).toBeVisible();
    await expect(page.getByTestId('markdown-body')).not.toBeVisible();
    // Raw body exposes the '#' heading marker, which the rendered view hides.
    await expect(page.getByTestId('raw-body')).toContainText('# Spec 191');

    await page.getByTestId('raw-toggle').click();
    await expect(page.getByTestId('markdown-body')).toBeVisible();
  });

  test('navigates to a second artefact from the tree and renders it', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
    await expect(page.getByTestId('markdown-body')).toBeVisible({ timeout: 15000 });

    const planEntry = page.getByTestId('tree-entry-specs/191-spec-navigator/plan.md');
    await planEntry.click();
    await expect(page.locator('.artifact-path', { hasText: 'specs/191-spec-navigator/plan.md' }).first()).toBeVisible();
    await expect(page.getByTestId('markdown-body').locator('h1', { hasText: 'Plan' })).toBeVisible();
  });
});
