import React from 'react';
import { cn } from '@/lib/utils';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Visual variant of the glass effect
   * @default 'medium'
   */
  variant?: 'light' | 'medium' | 'heavy' | 'ultra';
  
  /**
   * Add glow effect with specified color
   */
  glowColor?: 'blue' | 'green' | 'yellow' | 'red' | 'none';
  
  /**
   * Padding size
   * @default 'md'
   */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Border radius
   * @default 'lg'
   */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  
  /**
   * Enable hover effects
   * @default false
   */
  hoverable?: boolean;
  
  /**
   * Make card clickable (adds cursor pointer)
   * @default false
   */
  clickable?: boolean;
  
  children: React.ReactNode;
}

const variantClasses = {
  light: 'glass-light',
  medium: 'glass-medium',
  heavy: 'glass-heavy',
  ultra: 'glass-ultra',
};

const glowClasses = {
  blue: 'shadow-glow-blue',
  green: 'shadow-glow-green',
  yellow: 'shadow-glow-yellow',
  red: 'shadow-glow-red',
  none: '',
};

const paddingClasses = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-10',
};

const roundedClasses = {
  none: 'rounded-none',
  sm: 'rounded-glass-sm',
  md: 'rounded-glass-md',
  lg: 'rounded-glass-lg',
  xl: 'rounded-glass-xl',
  '2xl': 'rounded-glass-2xl',
};

/**
 * GlassCard - A card component with glassmorphism effect
 * 
 * @example
 * ```tsx
 * <GlassCard variant="medium" glowColor="blue" hoverable>
 *   <h2>Card Title</h2>
 *   <p>Card content</p>
 * </GlassCard>
 * ```
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      variant = 'medium',
      glowColor = 'none',
      padding = 'md',
      rounded = 'lg',
      hoverable = false,
      clickable = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          'relative overflow-hidden',
          'border border-glass-border-DEFAULT',
          'shadow-glass',
          'transition-all duration-300 ease-out',
          
          // Variant
          variantClasses[variant],
          
          // Glow
          glowColor !== 'none' && glowClasses[glowColor],
          
          // Padding
          paddingClasses[padding],
          
          // Rounded
          roundedClasses[rounded],
          
          // Hoverable
          hoverable && [
            'hover:scale-[1.02]',
            'hover:border-glass-border-glow',
            'hover:shadow-glass-xl',
            'hover:-translate-y-0.5',
          ],
          
          // Clickable
          clickable && 'cursor-pointer',
          
          // Custom className
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
