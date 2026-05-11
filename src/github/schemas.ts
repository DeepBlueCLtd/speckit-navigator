import { z } from 'zod';

/**
 * Zod schemas narrowing GitHub REST responses at the fetch boundary.
 * Anything unknown is discarded. Strict enough to reject wildly wrong
 * payloads without being so brittle that GitHub adding a field breaks us —
 * so we use `.passthrough()` to accept-and-drop unknown fields rather than
 * `.strict()` (which would throw).
 */

export const PullRequestHeadSchema = z
  .object({
    sha: z.string().regex(/^[0-9a-f]{40}$/i, 'expected 40-char SHA-1 hex'),
    ref: z.string().min(1),
  })
  .passthrough();

export const PullRequestSchema = z
  .object({
    number: z.number().int().positive(),
    state: z.union([z.literal('open'), z.literal('closed')]),
    title: z.string(),
    head: PullRequestHeadSchema,
  })
  .passthrough();

export type PullRequest = z.infer<typeof PullRequestSchema>;

export const ContentsEntrySchema = z
  .object({
    name: z.string(),
    path: z.string(),
    type: z.union([
      z.literal('file'),
      z.literal('dir'),
      z.literal('symlink'),
      z.literal('submodule'),
    ]),
    size: z.number().int().nonnegative(),
    download_url: z.string().url().nullable(),
  })
  .passthrough();

export const ContentsListingSchema = z.array(ContentsEntrySchema);

export type ContentsEntry = z.infer<typeof ContentsEntrySchema>;

export const IssueCommentCreateResponseSchema = z
  .object({
    id: z.number().int().positive(),
    html_url: z.string().url(),
    created_at: z.string(),
  })
  .passthrough();

export type IssueCommentCreateResponse = z.infer<typeof IssueCommentCreateResponseSchema>;

export const ChangedFileSchema = z
  .object({
    filename: z.string(),
    status: z.string(),
  })
  .passthrough();

export const ChangedFilesSchema = z.array(ChangedFileSchema);

/**
 * Summary form of a PR returned by `GET /repos/:owner/:repo/pulls`.
 * Narrower than a full PullRequest — we only need `number`, `title`, and
 * the head branch ref to offer a "did you mean…?" list when the user
 * typed a bad `?pr=` number.
 */
export const PullRequestSummarySchema = z
  .object({
    number: z.number().int().positive(),
    title: z.string(),
    head: z
      .object({
        ref: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

export const PullRequestListSchema = z.array(PullRequestSummarySchema);

export type PullRequestSummary = z.infer<typeof PullRequestSummarySchema>;
