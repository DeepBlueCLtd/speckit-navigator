import { useEffect, useState } from 'react';
import type { Artefact, AppError, FeatureScope } from '../types';
import { classifyArtefact, mimeTypeFromPath } from '../format/classifyArtefact';
import {
  ApiError,
  fetchChangedFiles,
  fetchContentsListing,
  fetchPullRequest,
  type ApiOptions,
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

export interface UseFeatureInput {
  prNumber: number | null;
  branch?: string | null;
  apiOptions?: ApiOptions;
}

const FEATURE_FOLDER_RE = /^(specs\/\d{3,}-[a-z0-9-]+)\//;

function pickFeatureFolder(changedPaths: string[]): string | null {
  for (const p of changedPaths) {
    const m = p.match(FEATURE_FOLDER_RE);
    if (m) return m[1];
  }
  return null;
}

async function listArtefacts(
  folder: string,
  ref: string,
  apiOptions: ApiOptions = {},
): Promise<Artefact[]> {
  const out: Artefact[] = [];
  const entries = await fetchContentsListing(folder, ref, apiOptions);
  for (const entry of entries) {
    if (entry.type === 'dir') {
      if (/(contracts|evidence|checklists|screenshots|media)$/.test(entry.path)) {
        const subEntries = await fetchContentsListing(entry.path, ref, apiOptions);
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

async function pickFeatureFolderOnBranch(
  ref: string,
  apiOptions: ApiOptions,
): Promise<string | null> {
  const entries = await fetchContentsListing('specs', ref, apiOptions);
  for (const entry of entries) {
    if (entry.type === 'dir' && /^specs\/\d{3,}-[a-z0-9-]+$/.test(entry.path)) {
      return entry.path;
    }
  }
  return null;
}

export function useFeature(
  arg: number | null | UseFeatureInput,
): UseFeatureResult {
  const input: UseFeatureInput =
    arg === null || typeof arg === 'number' ? { prNumber: arg } : arg;
  const prNumber = input.prNumber;
  const branch = input.branch ?? null;
  const apiOptions = input.apiOptions ?? {};
  const owner = apiOptions.owner ?? DEFAULT_OWNER;
  const repo = apiOptions.repo ?? DEFAULT_REPO;

  const [scope, setScope] = useState<FeatureScope | null>(null);
  const [artefacts, setArtefacts] = useState<Artefact[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);
  const [patVersion, setPatVersion] = useState<number>(0);

  useEffect(() => {
    const unsub = subscribePat(() => setPatVersion((v) => v + 1));
    return unsub;
  }, []);

  useEffect(() => {
    if (prNumber === null && branch === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const effectApiOptions: ApiOptions = { owner, repo };

    (async (): Promise<void> => {
      try {
        if (prNumber !== null) {
          const pr = await fetchPullRequest(prNumber, effectApiOptions);
          const changedFiles = await fetchChangedFiles(prNumber, effectApiOptions);
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
            repoOwner: owner,
            repoName: repo,
            headSha: pr.head.sha,
            featureFolder: folder,
          };
          const list = await listArtefacts(folder, pr.head.sha, effectApiOptions);
          if (cancelled) return;
          setScope(nextScope);
          setArtefacts(list);
          setLoading(false);
          return;
        }

        // branch-only mode: list specs/ on the branch and pick the first
        // feature folder. Comments are disabled (prNumber is null in scope).
        const folder = await pickFeatureFolderOnBranch(branch as string, effectApiOptions);
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
          prNumber: null,
          repoOwner: owner,
          repoName: repo,
          headSha: branch as string,
          featureFolder: folder,
        };
        const list = await listArtefacts(folder, branch as string, effectApiOptions);
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
  }, [prNumber, branch, owner, repo, patVersion]);

  return { scope, artefacts, loading, error };
}

export { pickFeatureFolder, listArtefacts };
