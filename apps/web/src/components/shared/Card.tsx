import { HTMLAttributes, forwardRef, ElementType } from 'react';

type CardElevation = 'flat' | 'resting' | 'raised' | 'floating';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  elevation?: CardElevation;
  as?: 'div' | 'section' | 'article';
  /** Overrides default padding for this elevation (replaces .card p-4 on resting). */
  padding?: string;
}

const RESTING_BASE = 'rounded-xl border border-border bg-surface-1 shadow-md';

const elevationClasses: Record<Exclude<CardElevation, 'resting'>, string> = {
  flat: 'rounded-lg border border-border bg-bg',
  raised: 'rounded-lg border border-border bg-bgElev shadow-md p-4',
  floating: 'rounded-xl border border-border bg-bgElev shadow-lg p-4',
};

function restingClass(padding?: string): string {
  return padding ? `${RESTING_BASE} ${padding}` : 'card';
}

export const Card = forwardRef<HTMLElement, CardProps>(
  (
    {
      elevation = 'resting',
      as: Tag = 'div',
      padding,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const Component = Tag as ElementType;
    const elevClass = elevation === 'resting' ? restingClass(padding) : elevationClasses[elevation];
    const padClass =
      elevation !== 'resting' ? (padding ?? '') : '';

    return (
      <Component
        ref={ref}
        className={`${elevClass} ${padClass} ${className}`.trim()}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Card.displayName = 'Card';
