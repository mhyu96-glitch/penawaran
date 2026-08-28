import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'draft' | 'sent' | 'accepted' | 'rejected' | 'paid' | 'overdue' | 'default';

export interface GlassBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Badge variant (status type)
   * @default 'default'
   */
  variant?: BadgeVariant;
  
  /**
   * Badge size
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Add pulsing animation (useful for overdue status)
   * @default false
   */
  pulse?: boolean;
  
  /**
   * Optional icon element
   */
  icon?: React.ReactNode;
  
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  draft: 'badge-draft',
  sent: 'badge-sent',
  accepted: 'badge-accepted',
  rejected: 'badge-rejected',
  paid: 'badge-paid',
  overdue: 'badge-overdue',
  default: 'bg-glass-bg-light border border-glass-border-DEFAULT text-glass-text-secondary',
};

const sizeClasses = {
  sm: 'px-2 py-1 text-[10px] gap-1',
  md: 'px-3 py-1.5 text-[11px] gap-1.5',
  lg: 'px-4 py-2 text-xs gap-2',
};

/**
 * GlassBadge - Status badge component with glassmorphism styling
 * 
 * @example
 * ```tsx
 * <GlassBadge variant="sent">Terkirim</GlassBadge>
 * <GlassBadge variant="overdue" pulse>Overdue</GlassBadge>
 * <GlassBadge variant="paid" icon={<CheckCircle />}>Lunas</GlassBadge>
 * ```
 */
export const GlassBadge = React.forwardRef<HTMLSpanElement, GlassBadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      pulse = false,
      icon,
      className,
      children,
      ...props
    },
    ref
  ) => {
    // Auto-enable pulse for overdue variant
    const shouldPulse = pulse || variant === 'overdue';
    
    return (
      <span
        ref={ref}
        className={cn(
          // Base badge class
          'badge',
          'inline-flex items-center justify-center',
          'font-semibold uppercase tracking-wider',
          'rounded-glass-sm',
          'backdrop-blur-sm',
          'select-none',
          'whitespace-nowrap',
          
          // Variant
          variantClasses[variant],
          
          // Size
          sizeClasses[size],
          
          // Pulse animation
          shouldPulse && 'animate-pulse-slow',
          
          // Custom className
          className
        )}
        {...props}
      >
        {icon && <span className="inline-flex">{icon}</span>}
        <span>{children}</span>
      </span>
    );
  }
);

GlassBadge.displayName = 'GlassBadge';

/**
 * Helper function to get badge variant from status string
 * Useful for mapping database status to badge variant
 */
export function getBadgeVariant(status: string): BadgeVariant {
  const statusLower = status.toLowerCase();
  
  const variantMap: Record<string, BadgeVariant> = {
    draft: 'draft',
    sent: 'sent',
    terkirim: 'sent',
    accepted: 'accepted',
    diterima: 'accepted',
    rejected: 'rejected',
    ditolak: 'rejected',
    paid: 'paid',
    lunas: 'paid',
    overdue: 'overdue',
    'jatuh tempo': 'overdue',
  };
  
  return variantMap[statusLower] || 'default';
}

/**
 * Helper function to get Indonesian label from status
 */
export function getStatusLabel(status: string): string {
  const statusLower = status.toLowerCase();
  
  const labelMap: Record<string, string> = {
    draft: 'Draft',
    sent: 'Terkirim',
    terkirim: 'Terkirim',
    accepted: 'Diterima',
    diterima: 'Diterima',
    rejected: 'Ditolak',
    ditolak: 'Ditolak',
    paid: 'Lunas',
    lunas: 'Lunas',
    overdue: 'Jatuh Tempo',
    'jatuh tempo': 'Jatuh Tempo',
  };
  
  return labelMap[statusLower] || status;
}
