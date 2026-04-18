import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--ud-bg))] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[rgb(var(--ud-primary))] text-[rgb(var(--ud-primary-fg))] hover:bg-[rgb(var(--ud-primary))]/90 focus-visible:ring-[rgb(var(--ud-primary))]',
        secondary:
          'bg-[rgb(var(--ud-muted))] text-[rgb(var(--ud-fg))] hover:bg-[rgb(var(--ud-muted))]/80 focus-visible:ring-[rgb(var(--ud-border))]',
        ghost:
          'bg-transparent text-[rgb(var(--ud-fg))] hover:bg-[rgb(var(--ud-muted))] focus-visible:ring-[rgb(var(--ud-border))]',
        destructive:
          'bg-[rgb(var(--ud-destructive))] text-white hover:bg-[rgb(var(--ud-destructive))]/90 focus-visible:ring-[rgb(var(--ud-destructive))]',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
