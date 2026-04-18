import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-lg border border-[rgb(var(--ud-border))] bg-[rgb(var(--ud-bg))] text-[rgb(var(--ud-fg))] shadow-sm',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';
