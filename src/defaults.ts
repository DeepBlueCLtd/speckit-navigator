/**
 * Centralised defaults for the target GitHub repository the navigator renders.
 *
 * Resolution order (highest to lowest priority):
 *   1. Build-time environment variables (`VITE_DEFAULT_OWNER`, `VITE_DEFAULT_REPO`).
 *   2. URL query-string parameters (handled by callers — `ApiOptions`).
 *   3. Bundled debrief defaults (this file's literal fallbacks).
 *
 * The literal `'debrief'` / `'debrief-future'` strings appear here, and only here,
 * as fallbacks. Every other module in `src/` reads these constants instead of
 * inlining the names — so when this app is extracted to its own repository
 * (#248 Phase 2), an adopter only needs to set the two env vars at build time
 * to retarget the entire SPA without touching source.
 */

const importMetaEnv: Record<string, string | undefined> =
  // Vite injects `import.meta.env`; fall back to an empty bag so the module
  // is also importable from non-Vite test runners (e.g. plain Vitest with
  // `environment: 'node'`) without throwing.
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env) ||
  {};

export const DEFAULT_OWNER: string = importMetaEnv.VITE_DEFAULT_OWNER ?? 'debrief';
export const DEFAULT_REPO: string = importMetaEnv.VITE_DEFAULT_REPO ?? 'debrief-future';

/**
 * Display label for the configured target repository, in `<owner>/<repo>` shape.
 * Used by user-facing strings that previously inlined `debrief/debrief-future`
 * (settings panel PAT scope description, OpenPrList empty message,
 * SpecBrowserModal title).
 */
export const DEFAULT_REPO_LABEL: string = `${DEFAULT_OWNER}/${DEFAULT_REPO}`;
