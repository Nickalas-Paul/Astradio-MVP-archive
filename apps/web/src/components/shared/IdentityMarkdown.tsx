'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { applyReadingPresentationPolicies } from '../../lib/reading-presentation-filter';

/** Markdown block lines that must not be sentence-merged (would break ### / ** parsing). */
function isMarkdownStructureBlock(block: string): boolean {
  const t = block.trim();
  if (!t) return false;
  if (/^#{1,6}\s/.test(t)) return true;
  if (/^\*\*[^*]+\*\*\s*$/.test(t)) return true;
  if (/^[-*]\s/.test(t)) return true;
  return false;
}

/**
 * Prepare identity/explainer markdown for ReactMarkdown.
 * Strips --- dividers and applies presentation filters only on prose blocks,
 * preserving headings and field labels as separate markdown blocks.
 */
export function prepareIdentityMarkdown(text: string): string {
  let cleaned = String(text || '').replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\n-{3,}\n/g, '\n\n');
  cleaned = cleaned.replace(/^-{3,}\s*$/gm, '');
  cleaned = cleaned.replace(/---\n/g, '\n');
  cleaned = cleaned.replace(/\n---/g, '\n');
  cleaned = cleaned.replace(/---/g, '');

  const blocks = cleaned.split(/\n\n+/);
  const processed = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (isMarkdownStructureBlock(trimmed)) return trimmed;
      return applyReadingPresentationPolicies(trimmed);
    })
    .filter(Boolean);

  return processed.join('\n\n').trim();
}

const IDENTITY_MARKDOWN_COMPONENTS: Components = {
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-text mb-4 mt-8 border-b border-border pb-2 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-text mb-3 mt-6 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold text-emerald-400/90 mb-2 mt-4 first:mt-0">{children}</h4>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-emerald-400/90 block mb-2 mt-4 first:mt-0">{children}</strong>
  ),
  p: ({ children }) => (
    <p className="text-subtext text-sm leading-relaxed mb-4 last:mb-0">{children}</p>
  ),
  hr: () => null,
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-subtext text-sm space-y-1 mb-4">{children}</ul>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  em: ({ children }) => <em className="text-subtext/80 italic">{children}</em>,
};

export function IdentityMarkdown({ content }: { content: string }) {
  const prepared = prepareIdentityMarkdown(content);
  if (!prepared) return null;
  return (
    <div className="max-w-3xl astradio-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={IDENTITY_MARKDOWN_COMPONENTS}>
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
