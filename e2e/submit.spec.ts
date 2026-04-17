import { test, expect } from '@playwright/test';
import {
  useMockGithubApi,
  seedPat,
  extractFencedPayload,
  MOCK_PR_NUMBER,
  MOCK_ORIGINAL_SHA,
} from './mock-github';

test.describe('submit flow (stable head)', () => {
  test.beforeEach(async ({ page }) => {
    await seedPat(page);
  });

  test('posts exactly one PR comment with a schema-valid fenced payload', async ({ page }) => {
    const mock = await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);

    // Wait for tree to populate.
    await expect(page.getByTestId('artifact-tree')).toBeVisible({ timeout: 15000 }).catch(() => {});

    // Open the feature-level composer, add a comment, save.
    await page.getByTestId('comment-feature-button').click();
    await page.getByTestId('composer-body').fill('Overall this spec looks solid.');
    await page.getByTestId('composer-save').click();

    // Submit.
    await page.getByTestId('submit-button').click();

    await expect(page.getByTestId('submit-success')).toBeVisible({ timeout: 10000 });

    const posted = mock.getPostedComments();
    expect(posted.length).toBe(1);

    const wire = JSON.parse(posted[0].body) as { body: string };
    expect(wire.body).toContain('@claude spec-review feedback submitted via spec-navigator.');
    expect(wire.body).toContain('```json spec-review-feedback-v1');

    const payload = extractFencedPayload(wire.body) as {
      schemaVersion: string;
      feature: string;
      pr: number;
      originalHeadSha: string;
      submittedAtHeadSha: string;
      comments: Array<{ level: string; body: string }>;
    };
    expect(payload.schemaVersion).toBe('spec-review-feedback-v1');
    expect(payload.pr).toBe(MOCK_PR_NUMBER);
    expect(payload.originalHeadSha).toBe(MOCK_ORIGINAL_SHA);
    expect(payload.submittedAtHeadSha).toBe(MOCK_ORIGINAL_SHA);
    expect(payload.comments.length).toBe(1);
    expect(payload.comments[0].level).toBe('feature');
    expect(payload.comments[0].body).toBe('Overall this spec looks solid.');
  });

  test('clears drafts after a successful submit (FR-022)', async ({ page }) => {
    await useMockGithubApi(page, 'stable-head');
    await page.goto(`/?pr=${MOCK_PR_NUMBER}`);

    await page.getByTestId('comment-feature-button').click();
    await page.getByTestId('composer-body').fill('A comment');
    await page.getByTestId('composer-save').click();

    await page.getByTestId('submit-button').click();
    await expect(page.getByTestId('submit-success')).toBeVisible({ timeout: 10000 });

    // Reload — drafts should be gone.
    await page.reload();
    // After reload the drawer shows the empty-state copy.
    await expect(page.getByText(/No drafts yet/)).toBeVisible({ timeout: 10000 });
  });
});
