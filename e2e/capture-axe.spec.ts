/**
 * Axe report capture (T101) — writes a single JSON file summarising
 * violations across the four audited states × two viewports. Runs only
 * when AXE_CAPTURE=1.
 */
import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { useMockGithubApi, seedPat, MOCK_PR_NUMBER } from './mock-github';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EVIDENCE_DIR = resolve(__dirname, '../../../specs/191-spec-navigator/evidence');

test.skip(process.env.AXE_CAPTURE !== '1', 'set AXE_CAPTURE=1 to produce axe-report.json');

test('axe: capture all states × viewports', async ({ browser }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const viewports = [
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'mobile', width: 375, height: 812 },
  ];
  const states: Array<{
    name: string;
    seedPat: boolean;
    scenario: 'stable-head' | 'stale-head';
    prepare: (page: import('@playwright/test').Page) => Promise<void>;
  }> = [
    {
      name: 'empty-drawer-settings-open',
      seedPat: false,
      scenario: 'stable-head',
      prepare: async () => {},
    },
    {
      name: 'drafts-drawer',
      seedPat: true,
      scenario: 'stable-head',
      prepare: async (page) => {
        await page.getByTestId('comment-feature-button').click();
        await page.getByTestId('composer-body').fill('Accessible draft.');
        await page.getByTestId('composer-save').click();
      },
    },
    {
      name: 'stale-head-modal',
      seedPat: true,
      scenario: 'stale-head',
      prepare: async (page) => {
        await page.getByTestId('comment-feature-button').click();
        await page.getByTestId('composer-body').fill('Trigger stale head.');
        await page.getByTestId('composer-save').click();
        await page.getByTestId('submit-button').click();
        await page.waitForSelector('[data-testid="stale-head-modal"]');
      },
    },
  ];

  const results: Array<{
    state: string;
    viewport: string;
    violations: unknown[];
    passes: number;
    incomplete: number;
  }> = [];

  for (const vp of viewports) {
    for (const s of states) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      if (s.seedPat) await seedPat(page);
      await useMockGithubApi(page, s.scenario);
      await page.goto(`/?pr=${MOCK_PR_NUMBER}`);
      if (s.seedPat) {
        await page.waitForSelector('[data-testid="markdown-body"]');
      } else {
        await page.waitForSelector('[data-testid="settings-panel"]');
      }
      await s.prepare(page);
      const res = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      results.push({
        state: s.name,
        viewport: vp.name,
        violations: res.violations,
        passes: res.passes.length,
        incomplete: res.incomplete.length,
      });
      await context.close();
    }
  }

  const totalViolations = results.reduce((n, r) => n + r.violations.length, 0);
  const report = {
    schema: 'axe-report-v1',
    captured_at: new Date().toISOString(),
    total_violations: totalViolations,
    results,
  };
  writeFileSync(
    resolve(EVIDENCE_DIR, 'axe-report.json'),
    JSON.stringify(report, null, 2),
  );
});
