#!/usr/bin/env node
//
// record-fixtures.mjs — refresh bundled GitHub fixtures under e2e/fixtures/.
//
// This is the maintainer-only inverse of e2e/fixtures-loader.ts: it runs the
// Playwright suite with LIVE_GITHUB=1, captures each api.github.com /
// raw.githubusercontent.com response, and serialises it into a per-route file
// plus an updated manifest.json. Requires a GITHUB_TOKEN env var.
//
// Status: stub. The recorder is not yet implemented — the project's current
// e2e tests use e2e/mock-github.ts (in-process scenarios), not bundled
// fixtures, so there is nothing to record yet. When the live-mode test suite
// lands (extraction-kit patches/03), this script will be filled in per the
// Playwright route-fulfill / page-route APIs.

console.error(
  '[record-fixtures] not yet implemented. See e2e/fixtures-loader.ts and ' +
    'extraction-kit/patches/03-bundled-fixtures.md for the intended design.',
);
process.exit(1);
