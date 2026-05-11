/**
 * Playwright route-intercept fixture for GitHub REST + raw endpoints.
 *
 * The SPA never makes a real network request during E2E — every call to
 * api.github.com and raw.githubusercontent.com is answered by the scenario
 * handler installed here. Each scenario returns a tailored response shape
 * and also records POST bodies so a test can assert "exactly one comment
 * was posted with this payload".
 */
import type { Page, Route } from '@playwright/test';

export type Scenario = 'stable-head' | 'stale-head' | '401' | 'empty-folder';

export const MOCK_PR_NUMBER = 42;
export const MOCK_ORIGINAL_SHA = 'a'.repeat(40);
export const MOCK_NEW_SHA = 'b'.repeat(40);
export const MOCK_FEATURE = '191-spec-navigator';
export const MOCK_FEATURE_FOLDER = `specs/${MOCK_FEATURE}`;

const SPEC_MD_BODY = `# Spec 191\n\nA short **spec** body.\n\n- item one\n- item two\n`;
const PLAN_MD_BODY = `# Plan\n\nPlan body for testing.\n`;

interface CapturedPost {
  url: string;
  body: string;
}

export interface MockHandle {
  getPostedComments(): CapturedPost[];
  getPrGetCount(): number;
  setHeadShaForNextPrGet(sha: string): void;
}

async function jsonRoute(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function textRoute(route: Route, status: number, text: string, contentType: string): Promise<void> {
  await route.fulfill({
    status,
    contentType,
    body: text,
  });
}

/**
 * Install GitHub API + raw.githubusercontent route handlers on the given page.
 * Returns a handle to inspect POSTed submissions and tweak scenario state.
 */
export async function useMockGithubApi(page: Page, scenario: Scenario): Promise<MockHandle> {
  const captured: CapturedPost[] = [];
  let prGetCount = 0;
  // Stale-head scenario overrides the SHA returned by the 2nd GET /pulls/:n.
  let nextHeadShaOverride: string | null = null;

  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    if (scenario === '401') {
      await jsonRoute(route, 401, { message: 'Bad credentials' });
      return;
    }

    if (method === 'GET' && url.match(/\/pulls\/\d+$/)) {
      prGetCount += 1;
      let sha = MOCK_ORIGINAL_SHA;
      if (nextHeadShaOverride) {
        sha = nextHeadShaOverride;
        nextHeadShaOverride = null;
      } else if (scenario === 'stale-head' && prGetCount >= 2) {
        sha = MOCK_NEW_SHA;
      }
      await jsonRoute(route, 200, {
        number: MOCK_PR_NUMBER,
        state: 'open',
        title: 'Test PR',
        head: { sha, ref: 'feat/test' },
      });
      return;
    }

    if (method === 'GET' && url.match(/\/pulls\/\d+\/files/)) {
      if (scenario === 'empty-folder') {
        await jsonRoute(route, 200, [
          { filename: 'README.md', status: 'modified' },
        ]);
        return;
      }
      await jsonRoute(route, 200, [
        { filename: `${MOCK_FEATURE_FOLDER}/spec.md`, status: 'modified' },
        { filename: `${MOCK_FEATURE_FOLDER}/plan.md`, status: 'added' },
      ]);
      return;
    }

    if (method === 'GET' && url.includes('/contents/' + encodeURIComponent(MOCK_FEATURE_FOLDER).replace(/%2F/gi, '/'))) {
      // fall through
    }

    if (method === 'GET' && url.includes('/contents/')) {
      // Decode the path portion of the URL after /contents/
      const match = url.match(/\/contents\/([^?]+)/);
      const path = match ? decodeURIComponent(match[1]) : '';
      if (path === MOCK_FEATURE_FOLDER) {
        await jsonRoute(route, 200, [
          {
            name: 'spec.md',
            path: `${MOCK_FEATURE_FOLDER}/spec.md`,
            type: 'file',
            size: SPEC_MD_BODY.length,
            download_url: `https://raw.githubusercontent.com/debrief/debrief-future/${MOCK_ORIGINAL_SHA}/${MOCK_FEATURE_FOLDER}/spec.md`,
          },
          {
            name: 'plan.md',
            path: `${MOCK_FEATURE_FOLDER}/plan.md`,
            type: 'file',
            size: PLAN_MD_BODY.length,
            download_url: `https://raw.githubusercontent.com/debrief/debrief-future/${MOCK_ORIGINAL_SHA}/${MOCK_FEATURE_FOLDER}/plan.md`,
          },
        ]);
        return;
      }
      await jsonRoute(route, 200, []);
      return;
    }

    if (method === 'POST' && url.match(/\/issues\/\d+\/comments$/)) {
      const body = req.postData() ?? '';
      captured.push({ url, body });
      await jsonRoute(route, 201, {
        id: 999,
        html_url: `https://github.com/debrief/debrief-future/pull/${MOCK_PR_NUMBER}#issuecomment-999`,
        created_at: '2026-04-17T12:00:00Z',
      });
      return;
    }

    await jsonRoute(route, 404, { message: `unmatched ${method} ${url}` });
  });

  await page.route('https://raw.githubusercontent.com/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith(`${MOCK_FEATURE_FOLDER}/spec.md`)) {
      await textRoute(route, 200, SPEC_MD_BODY, 'text/plain');
      return;
    }
    if (url.endsWith(`${MOCK_FEATURE_FOLDER}/plan.md`)) {
      await textRoute(route, 200, PLAN_MD_BODY, 'text/plain');
      return;
    }
    await textRoute(route, 404, 'not found', 'text/plain');
  });

  return {
    getPostedComments: () => captured.slice(),
    getPrGetCount: () => prGetCount,
    setHeadShaForNextPrGet: (sha: string) => {
      nextHeadShaOverride = sha;
    },
  };
}

/**
 * Prime localStorage with a fake PAT so the SPA skips the settings panel.
 */
export async function seedPat(page: Page, pat = 'e2e-test-pat'): Promise<void> {
  await page.addInitScript((patValue: string) => {
    localStorage.setItem(
      'spec-navigator:github-pat',
      JSON.stringify({ pat: patValue, savedAt: '2026-04-17T00:00:00Z' }),
    );
  }, pat);
}

/**
 * Extract the fenced `json spec-review-feedback-v1` payload from a PR comment body.
 */
export function extractFencedPayload(commentBody: string): unknown {
  const m = commentBody.match(/```json spec-review-feedback-v1\s*\n([\s\S]*?)\n```/);
  if (!m) throw new Error('no fenced spec-review-feedback-v1 block in body');
  return JSON.parse(m[1]);
}
