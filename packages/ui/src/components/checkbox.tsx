import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'h-4 w-4 cursor-pointer rounded border border-[rgb(var(--ud-border))] bg-[rgb(var(--ud-bg))] text-[rgb(var(--ud-primary))] accent-[rgb(var(--ud-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ud-primary))] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Checkbox.displayName = 'Checkbox';
