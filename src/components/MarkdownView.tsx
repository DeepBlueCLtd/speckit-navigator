import { memo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import type { Artefact, FeatureScope } from '../types';

interface Props {
  content: string;
  artefactPath: string;
  scope: FeatureScope | null;
  artefacts: Artefact[];
  onCrossLinkNavigate?: (path: string) => void;
}

function resolveWithinFeature(
  href: string,
  artefactPath: string,
  featureFolder: string,
): string | null {
  if (/^(https?:|mailto:|data:|javascript:)/i.test(href)) return null;
  if (href.startsWith('#')) return null;
  // anchor within same doc — leave to browser
  try {
    const base = `https://example.com/${artefactPath}`;
    const url = new URL(href, base);
    const relative = url.pathname.replace(/^\//, '');
    if (relative.startsWith(`${featureFolder}/`)) return relative;
    // relative inside-feature (e.g. "./plan.md" or "../tasks.md")
    if (relative.startsWith('specs/')) return null;
    return null;
  } catch {
    return null;
  }
}

function MarkdownViewImpl({
  content,
  artefactPath,
  scope,
  onCrossLinkNavigate,
}: Props): JSX.Element {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (!href || !scope || !onCrossLinkNavigate) return;
      const resolved = resolveWithinFeature(href, artefactPath, scope.featureFolder);
      if (resolved) {
        e.preventDefault();
        onCrossLinkNavigate(resolved);
      } else if (/^https?:/i.test(href)) {
        target.classList.add('external-link');
        target.setAttribute('target', '_blank');
        target.setAttribute('rel', 'noopener noreferrer');
      }
    },
    [artefactPath, scope, onCrossLinkNavigate],
  );

  return (
    <div className="artifact-body" onClick={handleClick} data-testid="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeAutolinkHeadings, rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownView = memo(MarkdownViewImpl);
