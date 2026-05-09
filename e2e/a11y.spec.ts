/**
 * Accessibility E2E (T087): @axe-core/playwright over four app states
 * at desktop + mobile viewports. Fails on any WCAG 2.1 AA violation.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { useMockGithubApi, seedPat, MOCK_PR_NUMBER } from './mock-github';

const VIEWPORTS: Array<{ name: string; width: number; height: number }> = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 812 },
];

for (const vp of VIEWPORTS) {
  test.describe(`a11y @ ${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test('read-only mode (no PAT, hint visible) has zero WCAG AA violations', async ({ page }) => {
      await useMockGithubApi(page, 'stable-head');
      await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
      await expect(page.getByTestId('read-only-hint')).toBeVisible();
      await expect(page.getByTestId('copy-feedback-button')).toBeVisible();
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
    });

    test('drafts drawer with entries has zero WCAG AA violations', async ({ page }) => {
      await seedPat(page);
      await useMockGithubApi(page, 'stable-head');
      await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
      await expect(page.getByTestId('markdown-body')).toBeVisible({ timeout: 15000 });

      await page.getByTestId('comment-feature-button').click();
      await page.getByTestId('composer-body').fill('Accessible draft.');
      await page.getByTestId('composer-save').click();
      await expect(page.getByText('Accessible draft.')).toBeVisible();

      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
    });

    test('StaleHeadModal has zero WCAG AA violations', async ({ page }) => {
      await seedPat(page);
      await useMockGithubApi(page, 'stale-head');
      await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
      await expect(page.getByTestId('markdown-body')).toBeVisible({ timeout: 15000 });
      await page.getByTestId('comment-feature-button').click();
      await page.getByTestId('composer-body').fill('Will trigger stale head.');
      await page.getByTestId('composer-save').click();
      await page.getByTestId('submit-button').click();
      await expect(page.getByTestId('stale-head-modal')).toBeVisible();

      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
    });
  });
}
