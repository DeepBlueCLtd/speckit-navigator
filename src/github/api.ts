/**
 * Typed REST wrappers for the GitHub endpoints we touch.
 * All requests are authenticated via the PAT from auth.ts; responses are
 * narrowed through zod schemas before returning.
 */

import { z } from 'zod';
import { strings } from '../strings';
import { DEFAULT_OWNER, DEFAULT_REPO } from '../defaults';
import { getPat } from './auth';
import {
  PullRequestSchema,
  PullRequestListSchema,
  ContentsListingSchema,
  IssueCommentCreateResponseSchema,
  ChangedFilesSchema,
  type PullRequest,
  type PullRequestSummary,
  type ContentsEntry,
  type IssueCommentCreateResponse,
} from './schemas';
import type { AppError } from '../types';

const API_BASE = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';

export interface ApiOptions {
  owner?: string;
  repo?: string;
}

export class ApiError extends Error {
  readonly kind: AppError['kind'];
  constructor(kind: AppError['kind'], message: string) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

function authHeaders(): Headers {
  const pat = getPat();
  const headers = new Headers({
    Accept: 'application/vnd.github+json',
  });
  if (pat) headers.set('Authorization', `Bearer ${pat}`);
  return headers;
}

function mapStatusToError(status: number, headers: Headers): AppError['kind'] {
  if (status === 401) return 'credential-rejected';
  if (status === 403) {
    if (headers.get('X-RateLimit-Remaining') === '0') return 'rate-limit';
    return 'credential-rejected';
  }
  if (status === 404) return 'pr-not-found';
  if (status === 422) return 'server-validation';
  if (status === 429) return 'rate-limit';
  return 'unknown';
}

function errorMessage(kind: AppError['kind']): string {
  switch (kind) {
    case 'credential-missing':
      return strings.errors.notAuthenticated;
    case 'credential-rejected':
      return strings.errors.credentialRejected;
    case 'pr-not-found':
      return strings.errors.prNotFound;
    case 'rate-limit':
      return strings.errors.rateLimit;
    case 'network':
      return strings.errors.network;
    case 'no-feature-folder':
      return strings.errors.noFeatureFolder;
    case 'server-validation':
      return strings.errors.serverValidation;
    case 'quota-exceeded':
      return strings.drawer.quotaWarning;
    case 'empty-submission':
      return strings.errors.submitEmpty;
    case 'unknown':
    default:
      return strings.errors.unknown;
  }
}

async function request<T>(
  url: string,
  init: RequestInit,
  schema: z.ZodSchema<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError('network', errorMessage('network'));
  }
  if (!response.ok) {
    const kind = mapStatusToError(response.status, response.headers);
    throw new ApiError(kind, errorMessage(kind));
  }
  const raw: unknown = await response.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError('unknown', errorMessage('unknown'));
  }
  return parsed.data;
}

export async function fetchPullRequest(
  prNumber: number,
  opts: ApiOptions = {},
): Promise<PullRequest> {
  const owner = opts.owner ?? DEFAULT_OWNER;
  const repo = opts.repo ?? DEFAULT_REPO;
  return request(
    `${API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`,
    { method: 'GET', headers: authHeaders() },
    PullRequestSchema,
  );
}

/**
 * List open pull requests — used by the "did you mean…?" offer when the
 * user's `?pr=` number 404s. Sorted newest-first (GitHub's default), capped
 * at 100 per page (the API's maximum); we don't paginate because offering
 * >100 open PRs in a dropdown would be unusable anyway.
 */
export async function fetchOpenPullRequests(
  opts: ApiOptions = {},
): Promise<PullRequestSummary[]> {
  const owner = opts.owner ?? DEFAULT_OWNER;
  const repo = opts.repo ?? DEFAULT_REPO;
  return request(
    `${API_BASE}/repos/${owner}/${repo}/pulls?state=open&per_page=100&sort=updated&direction=desc`,
    { method: 'GET', headers: authHeaders() },
    PullRequestListSchema,
  );
}

export async function fetchContentsListing(
  path: string,
  ref: string,
  opts: ApiOptions = {},
): Promise<ContentsEntry[]> {
  const owner = opts.owner ?? DEFAULT_OWNER;
  const repo = opts.repo ?? DEFAULT_REPO;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return request(
    `${API_BASE}/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`,
    { method: 'GET', headers: authHeaders() },
    ContentsListingSchema,
  );
}

export async function fetchChangedFiles(
  prNumber: number,
  opts: ApiOptions = {},
): Promise<string[]> {
  const owner = opts.owner ?? DEFAULT_OWNER;
  const repo = opts.repo ?? DEFAULT_REPO;
  const res = await request(
    `${API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
    { method: 'GET', headers: authHeaders() },
    ChangedFilesSchema,
  );
  return res.map((f) => f.filename);
}

/**
 * Headers for raw.githubusercontent.com. We intentionally do NOT send
 * Authorization here: raw.githubusercontent.com answers the CORS
 * preflight for a plain GET but refuses one with the Authorization
 * header, so sending the PAT actively breaks the fetch. The repo is
 * public, so unauthenticated GETs resolve. Private-repo support would
 * require routing through the Contents API (base64-encoded bodies).
 */
function rawHeaders(): Headers {
  return new Headers({ Accept: 'text/plain, */*' });
}

export async function fetchRawText(
  path: string,
  sha: string,
  opts: ApiOptions = {},
): Promise<string> {
  const owner = opts.owner ?? DEFAULT_OWNER;
  const repo = opts.repo ?? DEFAULT_REPO;
  const url = `${RAW_BASE}/${owner}/${repo}/${sha}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  let response: Response;
  try {
    response = await fetch(url, { headers: rawHeaders() });
  } catch {
    throw new ApiError('network', errorMessage('network'));
  }
  if (!response.ok) {
    const kind = mapStatusToError(response.status, response.headers);
    throw new ApiError(kind, errorMessage(kind));
  }
  return response.text();
}

export async function fetchRawBlob(
  path: string,
  sha: string,
  opts: ApiOptions = {},
): Promise<Blob> {
  const owner = opts.owner ?? DEFAULT_OWNER;
  const repo = opts.repo ?? DEFAULT_REPO;
  const url = `${RAW_BASE}/${owner}/${repo}/${sha}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  let response: Response;
  try {
    response = await fetch(url, { headers: rawHeaders() });
  } catch {
    throw new ApiError('network', errorMessage('network'));
  }
  if (!response.ok) {
    const kind = mapStatusToError(response.status, response.headers);
    throw new ApiError(kind, errorMessage(kind));
  }
  return response.blob();
}

export async function createIssueComment(
  prNumber: number,
  body: string,
  opts: ApiOptions = {},
): Promise<IssueCommentCreateResponse> {
  if (!getPat()) {
    throw new ApiError('credential-missing', errorMessage('credential-missing'));
  }
  const owner = opts.owner ?? DEFAULT_OWNER;
  const repo = opts.repo ?? DEFAULT_REPO;
  const headers = authHeaders();
  headers.set('Content-Type', 'application/json');
  const init: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify({ body }),
  };
  return request(
    `${API_BASE}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    init,
    IssueCommentCreateResponseSchema,
  );
}

export { errorMessage };
