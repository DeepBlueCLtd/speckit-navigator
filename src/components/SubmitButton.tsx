import { useCallback, useState } from 'react';
import { strings } from '../strings';
import type { Comment, Submission } from '../types';
import { ApiError, createIssueComment, fetchPullRequest } from '../github/api';
import { renderFeedbackComment } from '../format/renderFeedbackComment';
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

  const postSubmission = useCallback(
    async (submittedAtHeadSha: string): Promise<void> => {
      const featureBase = featureFolderBaseFromComments(comments);
      const submission: Submission = {
        schemaVersion: 'spec-review-feedback-v1',
        feature: featureBase,
        pr: prNumber,
        originalHeadSha: originalHeadSha ?? submittedAtHeadSha,
        submittedAtHeadSha,
        submittedAt: new Date().toISOString(),
        comments,
      };
      const body = renderFeedbackComment(submission);
      const response = await createIssueComment(prNumber, body);
      setSuccess({ url: response.html_url });
      onSuccess();
    },
    [prNumber, comments, originalHeadSha, onSuccess],
  );

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
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={submitting || comments.length === 0}
        data-testid="submit-button"
      >
        {submitting ? strings.buttons.submitting : strings.buttons.submit}
      </button>
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
