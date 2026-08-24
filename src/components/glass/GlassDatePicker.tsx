import React from 'react';
import { Calendar } from 'lucide-react';

interface GlassDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
}

export const GlassDatePicker: React.FC<GlassDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Pilih tanggal',
  error,
  disabled = false,
  min,
  max,
  className = '',
}) => {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          min={min}
          max={max}
          placeholder={placeholder}
          className={`
            glass-input w-full pr-10
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${error ? 'border-red-500' : ''}
          `}
        />
        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
};
