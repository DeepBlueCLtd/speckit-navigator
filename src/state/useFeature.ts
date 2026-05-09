import { useEffect, useState } from 'react';
import type { Artefact, AppError, FeatureScope } from '../types';
import { classifyArtefact, mimeTypeFromPath } from '../format/classifyArtefact';
import {
  ApiError,
  fetchChangedFiles,
  fetchContentsListing,
  fetchPullRequest,
} from '../github/api';
import { subscribePat } from '../github/auth';
import { DEFAULT_OWNER, DEFAULT_REPO } from '../defaults';
import { strings } from '../strings';

export interface UseFeatureResult {
  scope: FeatureScope | null;
  artefacts: Artefact[];
  loading: boolean;
  error: AppError | null;
}

const FEATURE_FOLDER_RE = /^(specs\/\d{3,}-[a-z0-9-]+)\//;

function pickFeatureFolder(changedPaths: string[]): string | null {
  for (const p of changedPaths) {
    const m = p.match(FEATURE_FOLDER_RE);
    if (m) return m[1];
  }
  return null;
}

async function listArtefacts(folder: string, ref: string): Promise<Artefact[]> {
  const out: Artefact[] = [];
  const entries = await fetchContentsListing(folder, ref);
  for (const entry of entries) {
    if (entry.type === 'dir') {
      if (/(contracts|evidence|checklists|screenshots|media)$/.test(entry.path)) {
        const subEntries = await fetchContentsListing(entry.path, ref);
        for (const sub of subEntries) {
          if (sub.type !== 'file') continue;
          out.push(toArtefact(sub));
        }
      }
      continue;
    }
    if (entry.type === 'file') {
      out.push(toArtefact(entry));
    }
  }
  return out;
}

function toArtefact(entry: {
  name: string;
  path: string;
  size: number;
  download_url: string | null;
}): Artefact {
  return {
    name: entry.name,
    path: entry.path,
    kind: classifyArtefact(entry.path),
    mimeType: mimeTypeFromPath(entry.path),
    size: entry.size,
    downloadUrl: entry.download_url,
    content: null,
    fetchedAt: null,
  };
}

export function useFeature(prNumber: number | null): UseFeatureResult {
  const [scope, setScope] = useState<FeatureScope | null>(null);
  const [artefacts, setArtefacts] = useState<Artefact[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);
  // Bump this counter whenever the PAT changes so the fetch effect re-runs.
  const [patVersion, setPatVersion] = useState<number>(0);

  useEffect(() => {
    const unsub = subscribePat(() => setPatVersion((v) => v + 1));
    return unsub;
  }, []);

  useEffect(() => {
    if (prNumber === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async (): Promise<void> => {
      try {
        const pr = await fetchPullRequest(prNumber);
        const changedFiles = await fetchChangedFiles(prNumber);
        const folder = pickFeatureFolder(changedFiles);
        if (!folder) {
          if (!cancelled) {
            setError({
              kind: 'no-feature-folder',
              message: strings.errors.noFeatureFolder,
            });
            setLoading(false);
          }
          return;
        }
        const nextScope: FeatureScope = {
          prNumber,
          repoOwner: DEFAULT_OWNER,
          repoName: DEFAULT_REPO,
          headSha: pr.head.sha,
          featureFolder: folder,
        };
        const list = await listArtefacts(folder, pr.head.sha);
        if (cancelled) return;
        setScope(nextScope);
        setArtefacts(list);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError) {
          setError({ kind: e.kind, message: e.message });
        } else {
          setError({ kind: 'unknown', message: strings.errors.unknown });
        }
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [prNumber, patVersion]);

  return { scope, artefacts, loading, error };
}

export { pickFeatureFolder, listArtefacts };
