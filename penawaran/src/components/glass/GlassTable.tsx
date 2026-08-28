import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface Column<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface GlassTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  
  /**
   * Enable sorting
   */
  sortable?: boolean;
  
  /**
   * Current sort configuration
   */
  sortConfig?: {
    key: string;
    direction: 'asc' | 'desc';
  } | null;
  
  /**
   * Sort change handler
   */
  onSort?: (key: string) => void;
  
  /**
   * Row click handler
   */
  onRowClick?: (row: T, index: number) => void;
  
  /**
   * Loading state
   */
  loading?: boolean;
  
  /**
   * Empty state message
   */
  emptyMessage?: string;
  
  /**
   * Hoverable rows
   */
  hoverable?: boolean;
  
  /**
   * Compact mode (smaller padding)
   */
  compact?: boolean;
}

/**
 * GlassTable - Data table with glassmorphism styling
 * 
 * @example
 * ```tsx
 * const columns = [
 *   { key: 'name', label: 'Name', sortable: true },
 *   { key: 'status', label: 'Status', render: (value) => <Badge>{value}</Badge> }
 * ];
 * 
 * <GlassTable
 *   columns={columns}
 *   data={items}
 *   keyExtractor={(item) => item.id}
 *   onRowClick={(item) => navigate(`/detail/${item.id}`)}
 *   hoverable
 * />
 * ```
 */
export function GlassTable<T = any>({
  columns,
  data,
  keyExtractor,
  sortable = false,
  sortConfig = null,
  onSort,
  onRowClick,
  loading = false,
  emptyMessage = 'Tidak ada data',
  hoverable = true,
  compact = false,
}: GlassTableProps<T>) {
  const handleSort = (key: string) => {
    if (sortable && onSort) {
      onSort(key);
    }
  };

  const renderSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    }
    
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  if (loading) {
    return (
      <div className="glass-table-container rounded-glass-lg overflow-hidden border border-glass-border-DEFAULT">
        <div className="animate-pulse p-8 text-center text-glass-text-secondary">
          Loading...
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="glass-table-container rounded-glass-lg overflow-hidden border border-glass-border-DEFAULT">
        <div className="p-8 text-center">
          <p className="text-glass-text-secondary">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-table-container rounded-glass-lg overflow-hidden border border-glass-border-DEFAULT">
      <div className="overflow-x-auto">
        <table className="glass-table w-full">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider',
                    'text-glass-text-secondary',
                    'glass-heavy backdrop-blur-lg',
                    'border-b border-glass-border-DEFAULT',
                    'sticky top-0 z-10',
                    compact && 'px-4 py-3',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right'
                  )}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.sortable && sortable ? (
                    <button
                      onClick={() => handleSort(column.key)}
                      className="flex items-center gap-2 hover:text-glass-text-primary transition-colors"
                    >
                      <span>{column.label}</span>
                      {renderSortIcon(column.key)}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={keyExtractor(row, index)}
                onClick={() => onRowClick?.(row, index)}
                className={cn(
                  'border-b border-glass-border-DEFAULT/50',
                  'bg-glass-bg-light/30',
                  'transition-all duration-200',
                  hoverable && [
                    'hover:bg-glass-bg-medium',
                    'hover:scale-[1.01]',
                    'hover:shadow-glass-sm',
                  ],
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((column) => {
                  const value = (row as any)[column.key];
                  return (
                    <td
                      key={column.key}
                      className={cn(
                        'px-6 py-4 text-sm text-glass-text-primary',
                        compact && 'px-4 py-3',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right'
                      )}
                    >
                      {column.render ? column.render(value, row, index) : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * GlassTableSkeleton - Loading skeleton for GlassTable
 */
export function GlassTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass-table-container rounded-glass-lg overflow-hidden border border-glass-border-DEFAULT">
      <div className="animate-pulse">
        {/* Header */}
        <div className="glass-heavy backdrop-blur-lg border-b border-glass-border-DEFAULT px-6 py-4">
          <div className="flex gap-8">
            <div className="h-4 w-32 rounded bg-glass-bg-medium" />
            <div className="h-4 w-24 rounded bg-glass-bg-medium" />
            <div className="h-4 w-20 rounded bg-glass-bg-medium" />
            <div className="h-4 w-28 rounded bg-glass-bg-medium" />
          </div>
        </div>
        
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="border-b border-glass-border-DEFAULT/50 bg-glass-bg-light/30 px-6 py-4"
          >
            <div className="flex gap-8">
              <div className="h-4 w-32 rounded bg-glass-bg-medium" />
              <div className="h-4 w-24 rounded bg-glass-bg-medium" />
              <div className="h-4 w-20 rounded bg-glass-bg-medium" />
              <div className="h-4 w-28 rounded bg-glass-bg-medium" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
