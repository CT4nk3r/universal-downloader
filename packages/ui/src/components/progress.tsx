import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indeterminate?: boolean;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, indeterminate = false, ...props }, ref) => {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={indeterminate ? undefined : value}
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--ud-muted))]',
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            'h-full rounded-full bg-[rgb(var(--ud-primary))] transition-[width] duration-300 ease-out',
            indeterminate && 'absolute left-0 w-1/3 animate-pulse',
          )}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = 'Progress';
