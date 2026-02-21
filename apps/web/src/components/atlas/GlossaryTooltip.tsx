'use client';

import { useState, useRef, useEffect } from 'react';
import { AtlasRegistry } from '../../core/atlas/registry';
import { motion, AnimatePresence } from 'framer-motion';
import { atlasTrackers } from '../../core/atlas/telemetry';

interface GlossaryTooltipProps {
  term: string;
  children: React.ReactNode;
  className?: string;
}

export default function GlossaryTooltip({ term, children, className = '' }: GlossaryTooltipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const article = AtlasRegistry.get(`glossary.${term.toLowerCase()}`);

  useEffect(() => {
    if (typeof window === 'undefined' || !open || !buttonRef.current || !tooltipRef.current) return;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

      let top = buttonRect.bottom + 8;
      let left = buttonRect.left;

    // Adjust if tooltip would go off screen
    if (left + tooltipRect.width > viewportWidth - 16) {
      left = viewportWidth - tooltipRect.width - 16;
    }
    if (left < 16) {
      left = 16;
    }
    if (top + tooltipRect.height > viewportHeight - 16) {
      top = buttonRect.top - tooltipRect.height - 8;
    }
    setPosition({ top, left });
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  if (!article) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className="relative inline-block">
      <button
        ref={buttonRef}
        className={`underline decoration-dotted decoration-emerald/50 hover:decoration-emerald transition-colors ${className}`}
        onClick={() => {
          setOpen(!open);
          if (!open) {
            atlasTrackers.glossaryHover(term);
          }
        }}
        onMouseEnter={() => {
          setOpen(true);
          atlasTrackers.glossaryHover(term);
        }}
        onMouseLeave={() => setOpen(false)}
        aria-label={`Learn about ${term}`}
      >
        {children}
      </button>
      
      <AnimatePresence>
        {open && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 max-w-xs p-4 rounded-xl border border-border bg-bgElev shadow-soft"
            style={{
              top: position.top,
              left: position.left,
            }}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-text">{article.title}</div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-subtext hover:text-text transition-colors"
                  aria-label="Close tooltip"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-xs text-subtext leading-relaxed whitespace-pre-wrap">
                {article.summary}
              </div>
              <div className="pt-2 border-t border-border">
                <a
                  href={`/atlas/a/${article.id}`}
                  className="text-xs text-emerald hover:text-emeraldMuted transition-colors"
                  onClick={() => setOpen(false)}
                >
                  Read full article →
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
