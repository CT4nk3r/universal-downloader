import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { useRadioGroup } from './radio-group.js';

export interface RadioItemProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name' | 'value'> {
  value: string;
  label?: ReactNode;
}

export const RadioItem = forwardRef<HTMLInputElement, RadioItemProps>(
  ({ className, value, label, disabled, onChange, children, ...props }, ref) => {
    const group = useRadioGroup();
    const isControlled = group.value !== undefined;
    const checked = isControlled ? group.value === value : undefined;
    const defaultChecked = !isControlled ? group.defaultValue === value : undefined;
    const isDisabled = disabled || group.disabled;
    return (
      <label
        className={cn(
          'inline-flex items-center gap-2 text-sm text-[rgb(var(--ud-fg))]',
          isDisabled && 'cursor-not-allowed opacity-50',
          !isDisabled && 'cursor-pointer',
          className,
        )}
      >
        <input
          ref={ref}
          type="radio"
          name={group.name}
          value={value}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={isDisabled}
          onChange={(e) => {
            onChange?.(e);
            if (e.currentTarget.checked) group.onValueChange?.(value);
          }}
          className="h-4 w-4 cursor-pointer border-[rgb(var(--ud-border))] text-[rgb(var(--ud-primary))] accent-[rgb(var(--ud-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ud-primary))]"
          {...props}
        />
        {label ?? children}
      </label>
    );
  },
);
RadioItem.displayName = 'RadioItem';
