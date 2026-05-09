/**
 * Unified type system for the Spec Navigator.
 * The same `Comment` shape is used both in draft-time memory and in the wire
 * payload posted on Submit (per reviewer decision 7C in plan.md).
 */

export type ArtefactKind =
  | 'spec'
  | 'plan'
  | 'tasks'
  | 'research'
  | 'data-model'
  | 'quickstart'
  | 'contract'
  | 'evidence-image'
  | 'evidence-doc'
  | 'other';

export type ArtefactMimeType =
  | 'text/markdown'
  | 'application/json'
  | 'application/yaml'
  | 'text/plain'
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'application/octet-stream';

export interface Artefact {
  path: string;
  name: string;
  kind: ArtefactKind;
  mimeType: ArtefactMimeType;
  size: number;
  downloadUrl: string | null;
  content: string | Blob | null;
  fetchedAt: string | null;
}

export interface FeatureScope {
  prNumber: number;
  repoOwner: string;
  repoName: string;
  headSha: string;
  featureFolder: string;
}

export type CommentTag = 'question' | 'scope-concern' | 'test-gap' | 'nit' | 'blocker';

export const COMMENT_TAGS: readonly CommentTag[] = [
  'question',
  'scope-concern',
  'test-gap',
  'nit',
  'blocker',
] as const;

interface CommentBase {
  id: string;
  body: string;
  tag?: CommentTag;
  createdAt?: string;
  updatedAt?: string;
}

export interface FeatureLevelComment extends CommentBase {
  level: 'feature';
}

export interface DocumentLevelComment extends CommentBase {
  level: 'document';
  path: string;
}

export interface SelectionLevelComment extends CommentBase {
  level: 'selection';
  path: string;
  snippet: string;
  contextBefore: string;
  contextAfter: string;
  anchorHash: string;
}

export type Comment = FeatureLevelComment | DocumentLevelComment | SelectionLevelComment;

export type CommentLevel = Comment['level'];

export interface SelectionContext {
  snippet: string;
  contextBefore: string;
  contextAfter: string;
  anchorHash: string;
}

export interface DraftCommentSet {
  schemaVersion: 1;
  prNumber: number;
  featureFolder: string;
  originalHeadSha: string;
  comments: Comment[];
  lastModified: string;
}

export interface Credential {
  pat: string;
  savedAt: string;
}

export interface Submission {
  schemaVersion: 'spec-review-feedback-v1';
  feature: string;
  pr: number;
  originalHeadSha: string;
  submittedAtHeadSha: string;
  submittedAt: string;
  comments: Comment[];
}

export type ErrorKind =
  | 'credential-missing'
  | 'credential-rejected'
  | 'pr-not-found'
  | 'rate-limit'
  | 'network'
  | 'no-feature-folder'
  | 'server-validation'
  | 'quota-exceeded'
  | 'empty-submission'
  | 'unknown';

export interface AppError {
  kind: ErrorKind;
  message: string;
}

/**
 * Input shape for creating a comment — the reducer assigns id/timestamps.
 */
export type CommentDraft =
  | { level: 'feature'; body: string; tag?: CommentTag }
  | { level: 'document'; path: string; body: string; tag?: CommentTag }
  | {
      level: 'selection';
      path: string;
      snippet: string;
      contextBefore: string;
      contextAfter: string;
      anchorHash: string;
      body: string;
      tag?: CommentTag;
    };
