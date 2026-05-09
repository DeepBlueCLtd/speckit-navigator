import { DEFAULT_OWNER, DEFAULT_REPO } from '../defaults';

export interface ResolvedUrlParams {
  owner: string;
  repo: string;
  branch: string | null;
  prNumber: number | null;
  warnings: string[];
}

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const PR_RE = /^[0-9]+$/;

export function parseUrlParams(search: string): ResolvedUrlParams {
  const params = new URLSearchParams(search);
  const warnings: string[] = [];

  let owner = DEFAULT_OWNER;
  let repo = DEFAULT_REPO;
  let branch: string | null = null;
  let prNumber: number | null = null;

  const repoRaw = params.get('repo');
  const branchRaw = params.get('branch');
  const prRaw = params.get('pr');

  if (repoRaw) {
    if (REPO_RE.test(repoRaw)) {
      const [o, r] = repoRaw.split('/');
      owner = o;
      repo = r;
    } else {
      warnings.push(`Ignoring malformed ?repo= value: "${repoRaw}".`);
    }
  }

  if (branchRaw) {
    branch = branchRaw;
  }

  if (prRaw) {
    if (PR_RE.test(prRaw)) {
      const n = Number.parseInt(prRaw, 10);
      if (Number.isFinite(n) && n > 0) prNumber = n;
    } else {
      warnings.push(`Ignoring malformed ?pr= value: "${prRaw}".`);
    }
  }

  if (prNumber !== null && (repoRaw || branchRaw)) {
    warnings.push('Both ?pr= and ?repo=/?branch= were supplied; using the explicit form.');
    prNumber = null;
  }

  return { owner, repo, branch, prNumber, warnings };
}
