/**
 * Evidence capture helper (runs only when EVIDENCE_CAPTURE=1).
 * Produces the 5 screenshots + 1 interaction GIF required by T092–T097.
 *
 * Run with:
 *   EVIDENCE_CAPTURE=1 pnpm exec playwright test e2e/capture-evidence.spec.ts
 *
 * Skipped under default test runs so it does not bloat CI time.
 */
import { test } from '@playwright/test';
import { useMockGithubApi, seedPat, MOCK_PR_NUMBER } from './mock-github';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EVIDENCE_DIR = resolve(__dirname, '../../../specs/191-spec-navigator/evidence');
const SHOTS_DIR = resolve(EVIDENCE_DIR, 'screenshots');

test.describe.configure({ mode: 'serial' });

test.skip(
  process.env.EVIDENCE_CAPTURE !== '1',
  'set EVIDENCE_CAPTURE=1 to produce evidence artefacts',
);

test.beforeAll(() => {
  mkdirSync(SHOTS_DIR, { recursive: true });
});

test('capture: landing (no PAT, read-only hint)', async ({ page }) => {
  await useMockGithubApi(page, 'stable-head');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
  await page.waitForSelector('[data-testid="read-only-hint"]');
  await page.screenshot({ path: resolve(SHOTS_DIR, 'landing.png'), fullPage: true });
});

test('capture: settings panel (PAT revealed)', async ({ page }) => {
  await useMockGithubApi(page, 'stable-head');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
  await page.getByTestId('settings-toggle').click();
  await page.waitForSelector('[data-testid="settings-panel"]');
  await page.getByTestId('settings-pat-input').fill('github_pat_example_token');
  await page.getByTestId('settings-reveal').click();
  await page.screenshot({ path: resolve(SHOTS_DIR, 'settings-panel.png'), fullPage: true });
});

test('capture: drawer with drafts', async ({ page }) => {
  await seedPat(page);
  await useMockGithubApi(page, 'stable-head');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
  await page.waitForSelector('[data-testid="markdown-body"]');
  await page.getByTestId('comment-feature-button').click();
  await page.getByTestId('composer-body').fill('Looks good overall — scope is tight.');
  await page.getByTestId('composer-tag').selectOption('question');
  await page.getByTestId('composer-save').click();
  await page.getByTestId('drawer-collapse').click();
  await page.getByTestId('comment-document-button').click();
  await page.getByTestId('composer-body').fill('Consider renaming this field for clarity.');
  await page.getByTestId('composer-tag').selectOption('nit');
  await page.getByTestId('composer-save').click();
  await page.screenshot({ path: resolve(SHOTS_DIR, 'drawer-open.png'), fullPage: true });
});

test('capture: stale-head modal', async ({ page }) => {
  await seedPat(page);
  await useMockGithubApi(page, 'stale-head');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
  await page.waitForSelector('[data-testid="markdown-body"]');
  await page.getByTestId('comment-feature-button').click();
  await page.getByTestId('composer-body').fill('One more thought before shipping.');
  await page.getByTestId('composer-save').click();
  await page.getByTestId('submit-button').click();
  await page.waitForSelector('[data-testid="stale-head-modal"]');
  await page.screenshot({ path: resolve(SHOTS_DIR, 'stale-head-modal.png'), fullPage: true });
});

test('capture: mobile viewport', async ({ page }) => {
  await seedPat(page);
  await useMockGithubApi(page, 'stable-head');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
  await page.waitForSelector('[data-testid="markdown-body"]');
  await page.screenshot({ path: resolve(SHOTS_DIR, 'mobile.png'), fullPage: true });
});

test('capture: interaction video (compact to GIF in post-process step)', async ({ browser }) => {
  // Record video of the full compose → submit → success flow.
  const videoDir = resolve(EVIDENCE_DIR, '.video');
  mkdirSync(videoDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 960, height: 600 },
    recordVideo: { dir: videoDir, size: { width: 960, height: 600 } },
  });
  const page = await context.newPage();
  await seedPat(page);
  await useMockGithubApi(page, 'stable-head');
  await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
  await page.waitForSelector('[data-testid="markdown-body"]');
  await page.waitForTimeout(500);
  await page.getByTestId('comment-feature-button').click();
  await page.getByTestId('composer-body').fill('Clear scope, reviewed end-to-end.');
  await page.getByTestId('composer-tag').selectOption('question');
  await page.waitForTimeout(300);
  await page.getByTestId('composer-save').click();
  await page.waitForTimeout(300);
  await page.getByTestId('submit-button').click();
  await page.waitForSelector('[data-testid="submit-success"]');
  await page.waitForTimeout(800);
  await context.close();

  // Pick the most recent .webm in videoDir, rename to interaction.webm
  // (GIF conversion happens outside Playwright — ffmpeg in the build step).
  const entries = readdirSync(videoDir)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => ({ f, m: statSync(resolve(videoDir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  if (entries.length === 0) return;
  const src = resolve(videoDir, entries[0].f);
  const dst = resolve(EVIDENCE_DIR, 'interaction.webm');
  writeFileSync(dst, readFileSync(src));
  // Clean up other recordings.
  rmSync(videoDir, { recursive: true, force: true });
});
