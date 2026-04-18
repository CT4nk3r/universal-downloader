import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-[rgb(var(--ud-border))] bg-[rgb(var(--ud-bg))] px-3 py-2 text-sm text-[rgb(var(--ud-fg))] placeholder:text-[rgb(var(--ud-muted-fg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ud-primary))] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
