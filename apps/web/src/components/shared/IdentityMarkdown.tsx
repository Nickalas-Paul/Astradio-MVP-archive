'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { stripReadingPresentationNoise } from '../../lib/reading-presentation-filter';

/** Strip horizontal rules and presentation noise before markdown parse. */
export function prepareIdentityMarkdown(text: string): string {
  return stripReadingPresentationNoise(text)
    .replace(/\n-{3,}\n/g, '\n\n')
    .replace(/^-{3,}\s*$/gm, '')
    .trim();
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
};

export function IdentityMarkdown({ content }: { content: string }) {
  const prepared = prepareIdentityMarkdown(content);
  if (!prepared) return null;
  return (
    <div className="max-w-3xl">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={IDENTITY_MARKDOWN_COMPONENTS}>
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
