import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type DialogHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn.js';

export interface DialogProps
  extends Omit<DialogHTMLAttributes<HTMLDialogElement>, 'open' | 'onClose'> {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
}

export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(
  ({ open, onClose, className, children, ...props }, ref) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    useImperativeHandle(ref, () => dialogRef.current as HTMLDialogElement, []);

    useEffect(() => {
      const dlg = dialogRef.current;
      if (!dlg) return;
      if (open && !dlg.open) {
        if (typeof dlg.showModal === 'function') {
          dlg.showModal();
        } else {
          dlg.setAttribute('open', '');
        }
      } else if (!open && dlg.open) {
        dlg.close();
      }
    }, [open]);

    const handleCancel = useCallback(
      (e: Event) => {
        e.preventDefault();
        onClose();
      },
      [onClose],
    );

    useEffect(() => {
      const dlg = dialogRef.current;
      if (!dlg) return;
      dlg.addEventListener('cancel', handleCancel);
      return () => dlg.removeEventListener('cancel', handleCancel);
    }, [handleCancel]);

    return (
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) onClose();
        }}
        className={cn(
          'rounded-lg border border-[rgb(var(--ud-border))] bg-[rgb(var(--ud-bg))] p-0 text-[rgb(var(--ud-fg))] shadow-xl backdrop:bg-black/50',
          'open:animate-in open:fade-in-0',
          className,
        )}
        {...props}
      >
        <div className="p-6">{children}</div>
      </dialog>
    );
  },
);
Dialog.displayName = 'Dialog';

export interface DialogTitleProps {
  children?: ReactNode;
  className?: string;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  return <h2 className={cn('mb-2 text-lg font-semibold', className)}>{children}</h2>;
}

export interface DialogDescriptionProps {
  children?: ReactNode;
  className?: string;
}

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  return (
    <p className={cn('mb-4 text-sm text-[rgb(var(--ud-muted-fg))]', className)}>{children}</p>
  );
}
