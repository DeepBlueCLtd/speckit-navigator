import type { ArtefactKind, ArtefactMimeType } from '../types';

/**
 * Map a repo-relative path inside a feature folder to its ArtefactKind.
 * Order matters — more specific matches first (contracts/, evidence/).
 */
export function classifyArtefact(path: string): ArtefactKind {
  const lower = path.toLowerCase();
  if (lower.includes('/contracts/')) return 'contract';
  if (lower.includes('/evidence/')) {
    if (isImagePath(lower)) return 'evidence-image';
    return 'evidence-doc';
  }
  const base = baseName(lower);
  if (base === 'spec.md') return 'spec';
  if (base === 'plan.md') return 'plan';
  if (base === 'tasks.md') return 'tasks';
  if (base === 'research.md') return 'research';
  if (base === 'data-model.md') return 'data-model';
  if (base === 'quickstart.md') return 'quickstart';
  if (isImagePath(lower)) return 'evidence-image';
  return 'other';
}

export function mimeTypeFromPath(path: string): ArtefactMimeType {
  const lower = path.toLowerCase();
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'application/yaml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

function baseName(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx < 0 ? path : path.slice(idx + 1);
}

function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif)$/.test(path);
}
