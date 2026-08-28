import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Button visual variant
   * @default 'glass'
   */
  variant?: 'primary' | 'glass' | 'outline' | 'ghost';
  
  /**
   * Button size
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Add glow effect (only for primary variant)
   * @default true
   */
  glowing?: boolean;
  
  /**
   * Icon element to display
   */
  icon?: React.ReactNode;
  
  /**
   * Icon position
   * @default 'left'
   */
  iconPosition?: 'left' | 'right';
  
  /**
   * Full width button
   * @default false
   */
  fullWidth?: boolean;
  
  /**
   * Loading state
   * @default false
   */
  loading?: boolean;
  
  children: React.ReactNode;
}

const variantClasses = {
  primary: [
    'bg-gradient-to-br from-glass-accent-primary to-blue-600',
    'border border-glass-border-accent',
    'text-white font-semibold',
    'shadow-md',
    'hover:shadow-lg hover:-translate-y-0.5',
  ],
  glass: [
    'glass-medium',
    'border border-glass-border-DEFAULT',
    'text-glass-text-primary',
    'hover:glass-heavy hover:border-glass-border-glow hover:scale-[1.02]',
  ],
  outline: [
    'bg-transparent',
    'border-2 border-glass-border-glow',
    'text-glass-text-primary',
    'hover:bg-glass-light',
  ],
  ghost: [
    'bg-transparent',
    'text-glass-text-secondary',
    'hover:bg-glass-light hover:text-glass-text-primary',
  ],
};

const sizeClasses = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-6 text-sm gap-2',
  lg: 'h-12 px-8 text-base gap-2.5',
  xl: 'h-14 px-10 text-lg gap-3',
};

/**
 * GlassButton - Button component with glassmorphism styling
 * 
 * @example
 * ```tsx
 * <GlassButton variant="primary" icon={<Plus />}>
 *   Create Quote
 * </GlassButton>
 * 
 * <GlassButton variant="glass" size="lg" fullWidth loading>
 *   Loading...
 * </GlassButton>
 * ```
 */
export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      variant = 'glass',
      size = 'md',
      glowing = true,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      loading = false,
      disabled = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center',
          'rounded-glass-md',
          'font-medium',
          'transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent-primary focus-visible:ring-offset-2',
          'active:scale-95',
          
          // Variant
          variantClasses[variant],
          
          // Size
          sizeClasses[size],
          
          // Full width
          fullWidth && 'w-full',
          
          // Glow effect (primary only)
          variant === 'primary' && glowing && !isDisabled && 'hover:shadow-glow-blue',
          
          // Disabled state
          isDisabled && [
            'opacity-50',
            'cursor-not-allowed',
            'hover:transform-none',
            'hover:shadow-none',
          ],
          
          // Custom className
          className
        )}
        {...props}
      >
        {loading && (
          <Loader2 className="animate-spin" size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} />
        )}
        
        {!loading && icon && iconPosition === 'left' && (
          <span className="inline-flex">{icon}</span>
        )}
        
        <span>{children}</span>
        
        {!loading && icon && iconPosition === 'right' && (
          <span className="inline-flex">{icon}</span>
        )}
      </button>
    );
  }
);

GlassButton.displayName = 'GlassButton';
