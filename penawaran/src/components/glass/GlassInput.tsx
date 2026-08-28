import React from 'react';
import { cn } from '@/lib/utils';

export interface GlassInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /**
   * Input label
   */
  label?: string;
  
  /**
   * Error message to display
   */
  error?: string;
  
  /**
   * Helper text
   */
  helperText?: string;
  
  /**
   * Prefix element (icon or text)
   */
  prefix?: React.ReactNode;
  
  /**
   * Suffix element (icon or text)
   */
  suffix?: React.ReactNode;
  
  /**
   * Input size
   * @default 'md'
   */
  inputSize?: 'sm' | 'md' | 'lg';
  
  /**
   * Full width input
   * @default false
   */
  fullWidth?: boolean;
}

const sizeClasses = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

/**
 * GlassInput - Input field with glassmorphism styling
 * 
 * @example
 * ```tsx
 * <GlassInput 
 *   label="Email"
 *   type="email"
 *   placeholder="Enter your email"
 *   error="Invalid email"
 * />
 * 
 * <GlassInput 
 *   prefix={<Search size={16} />}
 *   placeholder="Search..."
 * />
 * ```
 */
export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  (
    {
      label,
      error,
      helperText,
      prefix,
      suffix,
      inputSize = 'md',
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;
    
    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {/* Label */}
        {label && (
          <label 
            className="text-xs font-medium text-glass-text-secondary uppercase tracking-wider"
            htmlFor={props.id}
          >
            {label}
            {props.required && <span className="text-glass-accent-error ml-1">*</span>}
          </label>
        )}
        
        {/* Input Container */}
        <div className="relative flex items-center">
          {/* Prefix */}
          {prefix && (
            <div className="absolute left-3 flex items-center text-glass-text-tertiary">
              {prefix}
            </div>
          )}
          
          {/* Input */}
          <input
            ref={ref}
            disabled={disabled}
            className={cn(
              // Base styles
              'glass-input',
              'w-full',
              'rounded-glass-sm',
              'border transition-all duration-200',
              'placeholder:text-glass-text-tertiary',
              'focus:outline-none focus:ring-2 focus:ring-glass-accent-primary/20',
              
              // Size
              sizeClasses[inputSize],
              
              // Prefix/Suffix padding
              prefix && 'pl-10',
              suffix && 'pr-10',
              
              // Error state
              hasError ? [
                'border-glass-accent-error',
                'focus:border-glass-accent-error',
                'focus:ring-glass-accent-error/20',
              ] : 'border-glass-border-DEFAULT focus:border-glass-accent-primary',
              
              // Disabled state
              disabled && 'opacity-50 cursor-not-allowed',
              
              // Custom className
              className
            )}
            {...props}
          />
          
          {/* Suffix */}
          {suffix && (
            <div className="absolute right-3 flex items-center text-glass-text-tertiary">
              {suffix}
            </div>
          )}
        </div>
        
        {/* Helper Text or Error */}
        {(helperText || error) && (
          <p 
            className={cn(
              'text-xs',
              hasError ? 'text-glass-accent-error' : 'text-glass-text-tertiary'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';

/**
 * GlassTextarea - Textarea with glassmorphism styling
 */
export interface GlassTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const GlassTextarea = React.forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;
    
    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {/* Label */}
        {label && (
          <label 
            className="text-xs font-medium text-glass-text-secondary uppercase tracking-wider"
            htmlFor={props.id}
          >
            {label}
            {props.required && <span className="text-glass-accent-error ml-1">*</span>}
          </label>
        )}
        
        {/* Textarea */}
        <textarea
          ref={ref}
          disabled={disabled}
          className={cn(
            // Base styles
            'glass-input',
            'w-full',
            'rounded-glass-sm',
            'border transition-all duration-200',
            'placeholder:text-glass-text-tertiary',
            'focus:outline-none focus:ring-2 focus:ring-glass-accent-primary/20',
            'min-h-[100px]',
            'resize-y',
            'p-4',
            
            // Error state
            hasError ? [
              'border-glass-accent-error',
              'focus:border-glass-accent-error',
              'focus:ring-glass-accent-error/20',
            ] : 'border-glass-border-DEFAULT focus:border-glass-accent-primary',
            
            // Disabled state
            disabled && 'opacity-50 cursor-not-allowed',
            
            // Custom className
            className
          )}
          {...props}
        />
        
        {/* Helper Text or Error */}
        {(helperText || error) && (
          <p 
            className={cn(
              'text-xs',
              hasError ? 'text-glass-accent-error' : 'text-glass-text-tertiary'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

GlassTextarea.displayName = 'GlassTextarea';
