import { HTMLAttributes, forwardRef, ElementType } from 'react';

type CardElevation = 'flat' | 'resting' | 'raised' | 'floating';
type CardSize = 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  elevation?: CardElevation;
  as?: 'div' | 'section' | 'article' | 'li';
  /** Named size — sm=p-4, md=p-5, lg=p-6. Overridden by explicit padding prop. */
  size?: CardSize;
  /** Raw Tailwind padding string — overrides size if both provided. */
  padding?: string;
  /** Applies lift-on-hover interactive affordance. */
  interactive?: boolean;
  /** Applies accent border + tint — for highlighted reading sections, PlacementHighlight. */
  highlighted?: boolean;
  /** Applies selection ring — for Listen/Sandbox mode pickers. */
  selected?: boolean;
}

const SIZE_PADDING: Record<CardSize, string> = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

const ELEVATION_BASE: Record<CardElevation, string> = {
  flat: 'rounded-lg border border-border bg-bg',
  resting: 'rounded-xl border border-border bg-surface-1 shadow-md',
  raised: 'rounded-lg border border-border bg-bgElev shadow-md',
  floating: 'rounded-xl border border-border bg-bgElev shadow-lg',
};

export const Card = forwardRef<HTMLElement, CardProps>(
  (
    {
      elevation = 'resting',
      as: Tag = 'div',
      size = 'sm',
      padding,
      interactive = false,
      highlighted = false,
      selected = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const Component = Tag as ElementType;

    const baseClass = ELEVATION_BASE[elevation];
    const padClass = padding ?? SIZE_PADDING[size];
    const interactiveClass = interactive
      ? 'transition-all duration-base ease-aurora cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)]'
      : '';
    const highlightedClass = highlighted ? 'border-accent/50 bg-accent/5' : '';
    const selectedClass = selected ? 'ring-2 ring-accent/40 border-accent/50' : '';

    return (
      <Component
        ref={ref}
        className={[baseClass, padClass, interactiveClass, highlightedClass, selectedClass, className]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Card.displayName = 'Card';
