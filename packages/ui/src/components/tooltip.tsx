import { forwardRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface TooltipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'content'> {
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
}

const sideClasses: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 mb-1 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-1 -translate-x-1/2',
  left: 'right-full top-1/2 mr-1 -translate-y-1/2',
  right: 'left-full top-1/2 ml-1 -translate-y-1/2',
};

export const Tooltip = forwardRef<HTMLSpanElement, TooltipProps>(
  ({ content, side = 'top', className, children, ...props }, ref) => {
    const [open, setOpen] = useState(false);
    return (
      <span
        ref={ref}
        className={cn('relative inline-flex', className)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        {...props}
      >
        {children}
        {open ? (
          <span
            role="tooltip"
            className={cn(
              'pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-[rgb(var(--ud-fg))] px-2 py-1 text-xs text-[rgb(var(--ud-bg))] shadow-md',
              sideClasses[side],
            )}
          >
            {content}
          </span>
        ) : null}
      </span>
    );
  },
);
Tooltip.displayName = 'Tooltip';
