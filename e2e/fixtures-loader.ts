import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, Route } from '@playwright/test';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const MANIFEST_PATH = join(FIXTURES_DIR, 'manifest.json');

function loadManifest(): Record<string, string> {
  if (!existsSync(MANIFEST_PATH)) return {};
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, string>;
}

/**
 * Replays recorded GitHub responses from e2e/fixtures/ when LIVE_GITHUB is unset.
 * When LIVE_GITHUB=1, returns without installing routes so the suite hits real
 * GitHub. The default e2e suite still uses e2e/mock-github.ts's scenario-driven
 * interceptor — this loader is the parallel mechanism for live/drift testing
 * (referenced by .github/workflows/live.yml via pnpm fixtures:record).
 */
export async function mountGithubFixtures(page: Page): Promise<void> {
  if (process.env.LIVE_GITHUB === '1') return;

  const manifest = loadManifest();
  if (Object.keys(manifest).length === 0) return;

  const handler = async (route: Route): Promise<void> => {
    const url = new URL(route.request().url());
    const fixtureFile = manifest[url.pathname];
    if (!fixtureFile) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: `No fixture for ${url.pathname}` }),
      });
      return;
    }
    const body = readFileSync(join(FIXTURES_DIR, fixtureFile), 'utf8');
    const isJson = fixtureFile.endsWith('.json');
    await route.fulfill({
      status: 200,
      contentType: isJson ? 'application/vnd.github+json' : 'text/plain',
      body,
    });
  };

  await page.route('https://api.github.com/**', handler);
  await page.route('https://raw.githubusercontent.com/**', handler);
}
