import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-[rgb(var(--ud-border))] bg-[rgb(var(--ud-bg))] px-3 py-2 text-sm text-[rgb(var(--ud-fg))] placeholder:text-[rgb(var(--ud-muted-fg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ud-primary))] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
