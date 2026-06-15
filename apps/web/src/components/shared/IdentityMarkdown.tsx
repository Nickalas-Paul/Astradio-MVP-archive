'use client';

import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { applyReadingPresentationPolicies } from '../../lib/reading-presentation-filter';
import {
  extractTextContent,
  PlanetReference,
  PLANET_NAME_PATTERN,
} from './PlanetReference';

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

function buildMarkdownComponents(): Components {
  return {
    h2: ({ children }) => (
      <h2 className="reading-section-header mt-8 first:mt-0">{children}</h2>
    ),
    h3: ({ children, ...props }) => {
      const text = extractTextContent(children);
      const match = text.match(PLANET_NAME_PATTERN);
      if (match) {
        return (
          <h3 className="text-h3 font-serif text-accent mt-6 mb-3 first:mt-0" {...props}>
            <PlanetReference planetName={match[1]}>{children}</PlanetReference>
          </h3>
        );
      }
      return (
        <h3 className="text-h3 font-serif text-accent mt-6 mb-3 first:mt-0" {...props}>
          {children}
        </h3>
      );
    },
    h4: ({ children }) => (
      <h4 className="text-body font-semibold text-accent/90 mb-2 mt-4 first:mt-0">{children}</h4>
    ),
    strong: ({ children, ...props }) => {
      const text = extractTextContent(children);
      const match = text.match(PLANET_NAME_PATTERN);
      if (match) {
        return (
          <strong className="reading-field-label">
            <PlanetReference planetName={match[1]}>{children}</PlanetReference>
          </strong>
        );
      }
      return (
        <strong className="reading-field-label" {...props}>
          {children}
        </strong>
      );
    },
    p: ({ children }) => (
      <p className="text-body text-text-secondary mb-4 last:mb-0">{children}</p>
    ),
    hr: () => null,
    ul: ({ children }) => (
      <ul className="list-disc list-inside text-body text-text-secondary space-y-1 mb-4">{children}</ul>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    em: ({ children }) => <em className="text-text-secondary/80 italic">{children}</em>,
  };
}

export interface IdentityMarkdownProps {
  content: string;
  className?: string;
  sectionPlanets?: string[];
}

export function IdentityMarkdown({ content, className = '' }: IdentityMarkdownProps) {
  const prepared = prepareIdentityMarkdown(content);
  const components = useMemo(() => buildMarkdownComponents(), []);

  if (!prepared) return null;
  return (
    <div className={`max-w-3xl astradio-markdown ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
