import { HTMLAttributes, forwardRef, ElementType } from 'react';

type CardElevation = 'flat' | 'resting' | 'raised' | 'floating';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  elevation?: CardElevation;
  as?: 'div' | 'section' | 'article';
  padding?: string;
}

const elevationClasses: Record<CardElevation, string> = {
  flat: 'rounded-lg border border-border bg-bg',
  resting: 'card',
  raised: 'rounded-lg border border-border bg-bgElev shadow-md',
  floating: 'rounded-xl border border-border bg-bgElev shadow-lg',
};

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
    const padClass = padding ?? '';

    return (
      <Component
        ref={ref}
        className={`${elevationClasses[elevation]} ${padClass} ${className}`.trim()}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Card.displayName = 'Card';
