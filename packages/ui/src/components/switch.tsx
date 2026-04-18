import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, defaultChecked, ...props }, ref) => (
    <label
      className={cn(
        'relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full bg-[rgb(var(--ud-muted))] transition-colors has-[:checked]:bg-[rgb(var(--ud-primary))] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
        className,
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        defaultChecked={defaultChecked}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none ml-0.5 inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
      />
    </label>
  ),
);
Switch.displayName = 'Switch';
