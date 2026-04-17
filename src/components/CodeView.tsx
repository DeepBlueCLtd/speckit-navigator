import { memo, useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import diff from 'highlight.js/lib/languages/diff';
import markdown from 'highlight.js/lib/languages/markdown';
import 'highlight.js/styles/github.css';
import type { ArtefactMimeType } from '../types';

hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('python', python);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('markdown', markdown);

interface Props {
  content: string;
  mimeType: ArtefactMimeType;
}

function pickLanguage(mimeType: ArtefactMimeType): string | undefined {
  if (mimeType === 'application/json') return 'json';
  if (mimeType === 'application/yaml') return 'yaml';
  return undefined;
}

function CodeViewImpl({ content, mimeType }: Props): JSX.Element {
  const highlighted = useMemo(() => {
    const lang = pickLanguage(mimeType);
    if (!lang) return null;
    try {
      return hljs.highlight(content, { language: lang }).value;
    } catch {
      return null;
    }
  }, [content, mimeType]);

  return (
    <pre className="artifact-body" data-testid="code-body">
      {highlighted ? (
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      ) : (
        <code>{content}</code>
      )}
    </pre>
  );
}

export const CodeView = memo(CodeViewImpl);
