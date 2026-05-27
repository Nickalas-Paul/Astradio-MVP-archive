import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'audio'
  | 'ghost'
  | 'outline'
  | 'danger';

type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  audio: 'btn-audio',
  ghost: 'btn-ghost',
  outline: 'btn-outline',
  danger:
    'inline-flex items-center justify-center text-center gap-2 rounded-lg px-4 py-2 text-red-400 font-medium bg-transparent hover:bg-red-500/10 active:scale-[0.97] active:bg-red-500/20 transition-all duration-fast ease-aurora focus:outline-none focus:ring-2 focus:ring-red-500/60 disabled:opacity-50 disabled:cursor-not-allowed',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm min-h-[44px]',
  md: 'min-h-[44px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${variantClasses[variant]} justify-center text-center ${sizeClasses[size]} ${className}`.trim()}
        {...props}
      >
        {loading ? (
          <>
            <span className="loading-spinner" aria-hidden />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
