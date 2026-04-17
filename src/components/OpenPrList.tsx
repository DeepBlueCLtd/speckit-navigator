import { useEffect, useState } from 'react';
import { strings } from '../strings';
import { ApiError, fetchOpenPullRequests } from '../github/api';
import { subscribePat } from '../github/auth';
import type { PullRequestSummary } from '../github/schemas';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; prs: PullRequestSummary[] }
  | { kind: 'error'; message: string };

/**
 * Shown under the error banner when the user's `?pr=` number 404'd
 * (kind: 'pr-not-found'). Lists every open PR on the repo so the user
 * can navigate to a valid one with one click. Requires a PAT — caller
 * should only render this when credentials are known to be present.
 */
export function OpenPrList(): JSX.Element {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [refreshTick, setRefreshTick] = useState<number>(0);

  useEffect(() => {
    const unsub = subscribePat(() => setRefreshTick((t) => t + 1));
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    (async (): Promise<void> => {
      try {
        const prs = await fetchOpenPullRequests();
        if (cancelled) return;
        setState({ kind: 'loaded', prs });
      } catch (e) {
        if (cancelled) return;
        const message =
          e instanceof ApiError ? e.message : strings.openPrList.failed;
        setState({ kind: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  return (
    <div className="open-pr-list" data-testid="open-pr-list">
      <h3 className="open-pr-list-heading">{strings.openPrList.heading}</h3>
      {state.kind === 'loading' && (
        <p className="open-pr-list-status">{strings.openPrList.loading}</p>
      )}
      {state.kind === 'error' && (
        <p className="open-pr-list-status error-banner" role="alert">
          {state.message}
        </p>
      )}
      {state.kind === 'loaded' && state.prs.length === 0 && (
        <p className="open-pr-list-status">{strings.openPrList.empty}</p>
      )}
      {state.kind === 'loaded' && state.prs.length > 0 && (
        <ul className="open-pr-list-items" data-testid="open-pr-list-items">
          {state.prs.map((pr) => (
            <li key={pr.number}>
              <a
                href={`?pr=${pr.number}`}
                data-testid={`open-pr-link-${pr.number}`}
              >
                <span className="open-pr-number">#{pr.number}</span>{' '}
                <span className="open-pr-title">{pr.title}</span>{' '}
                <span className="open-pr-ref">{pr.head.ref}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
