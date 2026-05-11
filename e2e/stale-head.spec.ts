import { test, expect } from '@playwright/test';
import {
  useMockGithubApi,
  seedPat,
  extractFencedPayload,
  MOCK_PR_NUMBER,
  MOCK_ORIGINAL_SHA,
  MOCK_NEW_SHA,
} from './mock-github';

test.describe('stale head flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedPat(page);
  });

  test('opens StaleHeadModal when PR head.sha moves mid-review', async ({ page }) => {
    const mock = await useMockGithubApi(page, 'stale-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);

    await page.getByTestId('comment-feature-button').click();
    await page.getByTestId('composer-body').fill('This should hit the stale-head path.');
    await page.getByTestId('composer-save').click();

    await page.getByTestId('submit-button').click();
    await expect(page.getByTestId('stale-head-modal')).toBeVisible({ timeout: 10000 });

    // Shows both 7-char SHAs.
    await expect(page.getByText(MOCK_ORIGINAL_SHA.slice(0, 7))).toBeVisible();
    await expect(page.getByText(MOCK_NEW_SHA.slice(0, 7))).toBeVisible();

    // Nothing has been POSTed yet.
    expect(mock.getPostedComments().length).toBe(0);
  });

  test('Submit anyway POSTs with originalHeadSha !== submittedAtHeadSha', async ({ page }) => {
    const mock = await useMockGithubApi(page, 'stale-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);

    await page.getByTestId('comment-feature-button').click();
    await page.getByTestId('composer-body').fill('Submitting despite the head move.');
    await page.getByTestId('composer-save').click();

    await page.getByTestId('submit-button').click();
    await expect(page.getByTestId('stale-head-modal')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('stale-head-submit-anyway').click();

    await expect(page.getByTestId('submit-success')).toBeVisible({ timeout: 10000 });

    const posted = mock.getPostedComments();
    expect(posted.length).toBe(1);
    const body = JSON.parse(posted[0].body) as { body: string };
    const payload = extractFencedPayload(body.body) as {
      originalHeadSha: string;
      submittedAtHeadSha: string;
    };
    expect(payload.originalHeadSha).toBe(MOCK_ORIGINAL_SHA);
    expect(payload.submittedAtHeadSha).toBe(MOCK_NEW_SHA);

    // Human section should include the stale-head admonition.
    expect(body.body).toMatch(/Drafted against commit.*submitted against commit/);
  });

  test('Cancel preserves drafts and does not POST', async ({ page }) => {
    const mock = await useMockGithubApi(page, 'stale-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);

    await page.getByTestId('comment-feature-button').click();
    await page.getByTestId('composer-body').fill('Keep me around.');
    await page.getByTestId('composer-save').click();

    await page.getByTestId('submit-button').click();
    await expect(page.getByTestId('stale-head-modal')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('stale-head-cancel').click();

    await expect(page.getByTestId('stale-head-modal')).not.toBeVisible();
    expect(mock.getPostedComments().length).toBe(0);

    // Draft is still in the drawer.
    await expect(page.getByText('Keep me around.')).toBeVisible();
  });
});
