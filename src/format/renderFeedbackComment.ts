/**
 * Renders a Submission into the exact PR-comment body format described in
 * contracts/pr-comment-body.example.md.
 *
 * Output shape:
 *   line 1: trigger phrase
 *   blank line
 *   fenced ```json spec-review-feedback-v1 ... ``` block with the payload
 *   blank line
 *   human-readable sections (optional stale-head admonition, then groups)
 */

import type { Comment, Submission } from '../types';

const TRIGGER = '@claude spec-review feedback submitted via spec-navigator.';

export function renderFeedbackComment(submission: Submission): string {
  const parts: string[] = [];
  parts.push(TRIGGER);
  parts.push('');
  parts.push('```json spec-review-feedback-v1');
  parts.push(JSON.stringify(submissionForWire(submission), null, 2));
  parts.push('```');
  parts.push('');

  const human = renderHumanSections(submission);
  for (const line of human) parts.push(line);

  let out = parts.join('\n');
  // Exactly one trailing newline at end of body.
  out = out.replace(/\s+$/g, '');
  out += '\n';
  return out;
}

/** Strip any undefined-valued keys so the emitted JSON matches the schema. */
function submissionForWire(submission: Submission): Submission {
  const comments = submission.comments.map((c) => stripUndefined(c)) as Comment[];
  return {
    schemaVersion: submission.schemaVersion,
    feature: submission.feature,
    pr: submission.pr,
    originalHeadSha: submission.originalHeadSha,
    submittedAtHeadSha: submission.submittedAtHeadSha,
    submittedAt: submission.submittedAt,
    comments,
  };
}

function stripUndefined<T extends object>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

function renderHumanSections(submission: Submission): string[] {
  const lines: string[] = [];

  if (submission.originalHeadSha !== submission.submittedAtHeadSha) {
    const orig = submission.originalHeadSha.slice(0, 7);
    const cur = submission.submittedAtHeadSha.slice(0, 7);
    lines.push(
      `> ⚠️ Drafted against commit \`${orig}\`; submitted against commit \`${cur}\`. The pull request was updated during the review session.`,
    );
    lines.push('');
  }

  const featureLevel = submission.comments.filter((c) => c.level === 'feature');
  const byPathDoc = new Map<string, Comment[]>();
  const byPathSel = new Map<string, Comment[]>();
  for (const c of submission.comments) {
    if (c.level === 'document') {
      const arr = byPathDoc.get(c.path) ?? [];
      arr.push(c);
      byPathDoc.set(c.path, arr);
    } else if (c.level === 'selection') {
      const arr = byPathSel.get(c.path) ?? [];
      arr.push(c);
      byPathSel.set(c.path, arr);
    }
  }

  if (featureLevel.length > 0) {
    lines.push('## Feature-level');
    lines.push('');
    for (const c of featureLevel) lines.push(renderBullet(c));
    lines.push('');
  }

  // Emit document sections in insertion order (order of first appearance in comments[]).
  const seenPaths = new Set<string>();
  for (const c of submission.comments) {
    if (c.level === 'feature') continue;
    if (seenPaths.has(c.path)) continue;
    seenPaths.add(c.path);
    const docs = byPathDoc.get(c.path);
    const sels = byPathSel.get(c.path);
    if (docs && docs.length > 0) {
      lines.push(`## ${c.path}`);
      lines.push('');
      for (const d of docs) lines.push(renderBullet(d));
      lines.push('');
    }
    if (sels && sels.length > 0) {
      lines.push(`## ${c.path} — selection`);
      lines.push('');
      for (const s of sels) {
        if (s.level !== 'selection') continue;
        lines.push(`> ${s.snippet}`);
        lines.push('');
        lines.push(renderBullet(s));
        lines.push('');
      }
    }
  }

  return lines;
}

function renderBullet(c: Comment): string {
  if (c.tag) {
    return `- **${c.tag}** — ${c.body}`;
  }
  return `- ${c.body}`;
}

export { TRIGGER };
