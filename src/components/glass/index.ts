/**
 * Glass Morphism Component Library
 * 
 * A collection of glassmorphism-styled components for QuoteApp
 * Built with Tailwind CSS and React
 */

// Core Components
export { GlassCard } from './GlassCard';
export type { GlassCardProps } from './GlassCard';

export { GlassButton } from './GlassButton';
export type { GlassButtonProps } from './GlassButton';

export { GlassBadge, getBadgeVariant, getStatusLabel } from './GlassBadge';
export type { GlassBadgeProps, BadgeVariant } from './GlassBadge';

export { GlassInput, GlassTextarea } from './GlassInput';
export type { GlassInputProps, GlassTextareaProps } from './GlassInput';

export { GlassTable, GlassTableSkeleton } from './GlassTable';
export type { GlassTableProps, Column } from './GlassTable';

// Re-export utility types
export type GlassVariant = 'light' | 'medium' | 'heavy' | 'ultra';
export type GlassSize = 'sm' | 'md' | 'lg' | 'xl';
export type GlowColor = 'blue' | 'green' | 'yellow' | 'red' | 'none';
