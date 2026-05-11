import { useCallback, useEffect, useState } from 'react';
import { strings } from '../strings';
import type { Comment, Submission } from '../types';
import { ApiError, createIssueComment, fetchPullRequest } from '../github/api';
import { renderFeedbackComment } from '../format/renderFeedbackComment';
import { hasPat, subscribePat } from '../github/auth';
import { StaleHeadModal } from './StaleHeadModal';

interface Props {
  prNumber: number;
  comments: Comment[];
  originalHeadSha: string | undefined;
  onSuccess: () => void;
}

interface SuccessState {
  url: string;
}

function featureFolderBaseFromComments(comments: Comment[]): string {
  for (const c of comments) {
    if (c.level === 'feature') continue;
    const m = c.path.match(/^specs\/(\d{3,}-[a-z0-9-]+)\//);
    if (m) return m[1];
  }
  return 'unknown-feature';
}

function buildSubmission(
  prNumber: number,
  comments: Comment[],
  originalHeadSha: string | undefined,
  submittedAtHeadSha: string | undefined,
): Submission {
  const featureBase = featureFolderBaseFromComments(comments);
  const fallbackSha = originalHeadSha ?? submittedAtHeadSha ?? '';
  return {
    schemaVersion: 'spec-review-feedback-v1',
    feature: featureBase,
    pr: prNumber,
    originalHeadSha: originalHeadSha ?? fallbackSha,
    submittedAtHeadSha: submittedAtHeadSha ?? fallbackSha,
    submittedAt: new Date().toISOString(),
    comments,
  };
}

export function SubmitButton({
  prNumber,
  comments,
  originalHeadSha,
  onSuccess,
}: Props): JSX.Element {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [staleHead, setStaleHead] = useState<{ current: string } | null>(null);
  const [patPresent, setPatPresent] = useState<boolean>(() => hasPat());
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    return subscribePat(() => setPatPresent(hasPat()));
  }, []);

  const postSubmission = useCallback(
    async (submittedAtHeadSha: string): Promise<void> => {
      const submission = buildSubmission(
        prNumber,
        comments,
        originalHeadSha,
        submittedAtHeadSha,
      );
      const body = renderFeedbackComment(submission);
      const response = await createIssueComment(prNumber, body);
      setSuccess({ url: response.html_url });
      onSuccess();
    },
    [prNumber, comments, originalHeadSha, onSuccess],
  );

  const handleCopy = useCallback(async (): Promise<void> => {
    if (comments.length === 0) {
      setError(strings.errors.submitEmpty);
      return;
    }
    setError(null);
    const submission = buildSubmission(prNumber, comments, originalHeadSha, undefined);
    const body = renderFeedbackComment(submission);
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      setError(strings.errors.unknown);
    }
  }, [prNumber, comments, originalHeadSha]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (submitting) return;
    if (comments.length === 0) {
      setError(strings.errors.submitEmpty);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const pr = await fetchPullRequest(prNumber);
      const currentSha = pr.head.sha;
      if (originalHeadSha && currentSha !== originalHeadSha) {
        setStaleHead({ current: currentSha });
        setSubmitting(false);
        return;
      }
      await postSubmission(currentSha);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : strings.errors.unknown;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, comments.length, prNumber, originalHeadSha, postSubmission]);

  const confirmStaleHead = useCallback(async (): Promise<void> => {
    if (!staleHead) return;
    setSubmitting(true);
    try {
      await postSubmission(staleHead.current);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : strings.errors.unknown;
      setError(msg);
    } finally {
      setStaleHead(null);
      setSubmitting(false);
    }
  }, [staleHead, postSubmission]);

  if (success) {
    return (
      <div className="success-panel" data-testid="submit-success">
        <span>{strings.submit.success}</span>
        <a href={success.url} target="_blank" rel="noopener noreferrer">
          {strings.submit.viewComment}
        </a>
      </div>
    );
  }

  return (
    <>
      {patPresent ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting || comments.length === 0}
          data-testid="submit-button"
        >
          {submitting ? strings.buttons.submitting : strings.buttons.submit}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleCopy()}
          disabled={comments.length === 0}
          data-testid="copy-feedback-button"
        >
          {copied ? strings.buttons.copyFeedbackCopied : strings.buttons.copyFeedback}
        </button>
      )}
      {error && (
        <div className="error-banner" role="alert" data-testid="submit-error">
          {error}
        </div>
      )}
      {staleHead && originalHeadSha && (
        <StaleHeadModal
          originalHeadSha={originalHeadSha}
          currentHeadSha={staleHead.current}
          onSubmitAnyway={() => void confirmStaleHead()}
          onCancel={() => setStaleHead(null)}
        />
      )}
    </>
  );
}
