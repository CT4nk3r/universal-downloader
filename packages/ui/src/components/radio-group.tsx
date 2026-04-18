import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type HTMLAttributes,
} from 'react';
import { cn } from '../lib/cn.js';

interface RadioGroupContextValue {
  name: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export function useRadioGroup(): RadioGroupContextValue {
  const ctx = useContext(RadioGroupContext);
  if (!ctx) throw new Error('RadioItem must be used within a RadioGroup');
  return ctx;
}

export interface RadioGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  (
    { className, name, value, defaultValue, onValueChange, disabled, children, ...props },
    ref,
  ) => {
    const autoId = useId();
    const groupName = name ?? `radio-${autoId}`;
    return (
      <RadioGroupContext.Provider
        value={{ name: groupName, value, defaultValue, onValueChange, disabled }}
      >
        <div
          ref={ref}
          role="radiogroup"
          className={cn('flex flex-col gap-2', className)}
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  },
);
RadioGroup.displayName = 'RadioGroup';
