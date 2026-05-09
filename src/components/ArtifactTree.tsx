import { useMemo } from 'react';
import type { Artefact, ArtefactKind } from '../types';

const KIND_ORDER: ArtefactKind[] = [
  'spec',
  'plan',
  'tasks',
  'research',
  'data-model',
  'quickstart',
  'contract',
  'evidence-image',
  'evidence-doc',
  'other',
];

const KIND_LABEL: Record<ArtefactKind, string> = {
  spec: 'Spec',
  plan: 'Plan',
  tasks: 'Tasks',
  research: 'Research',
  'data-model': 'Data model',
  quickstart: 'Quickstart',
  contract: 'Contracts',
  'evidence-image': 'Evidence — images',
  'evidence-doc': 'Evidence — docs',
  other: 'Other',
};

interface Props {
  artefacts: Artefact[];
  selectedPath?: string;
  commentCountByPath: Record<string, number>;
  onSelect: (path: string) => void;
}

export function ArtifactTree({
  artefacts,
  selectedPath,
  commentCountByPath,
  onSelect,
}: Props): JSX.Element {
  const groups = useMemo(() => {
    const by: Partial<Record<ArtefactKind, Artefact[]>> = {};
    for (const a of artefacts) {
      const arr = by[a.kind] ?? [];
      arr.push(a);
      by[a.kind] = arr;
    }
    return KIND_ORDER.map((k) => ({ kind: k, items: by[k] ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [artefacts]);

  return (
    <nav aria-label="Artefact list" data-testid="artifact-tree">
      {groups.map((g) => (
        <div key={g.kind} className="tree-group">
          <div className="tree-group-header">{KIND_LABEL[g.kind]}</div>
          <ul className="tree-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {g.items.map((a) => {
              const count = commentCountByPath[a.path] ?? 0;
              const isSelected = a.path === selectedPath;
              return (
                <li key={a.path}>
                  <button
                    type="button"
                    className={`tree-entry ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => onSelect(a.path)}
                    data-testid={`tree-entry-${a.path}`}
                    aria-current={isSelected ? 'page' : undefined}
                  >
                    <span className="tree-entry-name">{a.name}</span>
                    {count > 0 && <span className="tree-count">{count}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
