import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-[rgb(var(--ud-muted))] text-[rgb(var(--ud-fg))] border border-[rgb(var(--ud-border))]',
        success: 'bg-[rgb(var(--ud-success))]/15 text-[rgb(var(--ud-success))]',
        warning: 'bg-[rgb(var(--ud-warning))]/15 text-[rgb(var(--ud-warning))]',
        destructive: 'bg-[rgb(var(--ud-destructive))]/15 text-[rgb(var(--ud-destructive))]',
        info: 'bg-[rgb(var(--ud-info))]/15 text-[rgb(var(--ud-info))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, BadgeVariantProps {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  ),
);
Badge.displayName = 'Badge';
