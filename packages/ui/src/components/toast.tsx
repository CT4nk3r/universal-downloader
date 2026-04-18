import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

export const toastVariants = cva(
  'pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-md border p-4 shadow-lg transition-all',
  {
    variants: {
      variant: {
        default: 'border-[rgb(var(--ud-border))] bg-[rgb(var(--ud-bg))] text-[rgb(var(--ud-fg))]',
        success:
          'border-[rgb(var(--ud-success))]/40 bg-[rgb(var(--ud-success))]/10 text-[rgb(var(--ud-fg))]',
        warning:
          'border-[rgb(var(--ud-warning))]/40 bg-[rgb(var(--ud-warning))]/10 text-[rgb(var(--ud-fg))]',
        destructive:
          'border-[rgb(var(--ud-destructive))]/40 bg-[rgb(var(--ud-destructive))]/10 text-[rgb(var(--ud-fg))]',
        info: 'border-[rgb(var(--ud-info))]/40 bg-[rgb(var(--ud-info))]/10 text-[rgb(var(--ud-fg))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type ToastVariantProps = VariantProps<typeof toastVariants>;

export type ToastVariant = NonNullable<ToastVariantProps['variant']>;

export interface ToastProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'>, ToastVariantProps {
  title?: ReactNode;
  description?: ReactNode;
  onDismiss?: () => void;
}

export const Toast = forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, title, description, onDismiss, children, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      <div className="flex-1">
        {title ? <div className="text-sm font-semibold">{title}</div> : null}
        {description ? (
          <div className="text-sm text-[rgb(var(--ud-muted-fg))]">{description}</div>
        ) : null}
        {children}
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="rounded-sm text-[rgb(var(--ud-muted-fg))] hover:text-[rgb(var(--ud-fg))]"
        >
          ×
        </button>
      ) : null}
    </div>
  ),
);
Toast.displayName = 'Toast';
