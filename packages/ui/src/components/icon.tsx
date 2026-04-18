import { forwardRef, type ComponentType, type SVGAttributes } from 'react';
import type { LucideProps } from 'lucide-react';
import { cn } from '../lib/cn.js';

export type IconComponent = ComponentType<LucideProps>;

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeMap: Record<IconSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children'> {
  icon: IconComponent;
  size?: IconSize | number;
  strokeWidth?: number;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ icon: IconCmp, size = 'md', strokeWidth = 2, className, ...props }, ref) => {
    const px = typeof size === 'number' ? size : sizeMap[size];
    return (
      <IconCmp
        ref={ref}
        size={px}
        strokeWidth={strokeWidth}
        className={cn('shrink-0', className)}
        aria-hidden="true"
        {...props}
      />
    );
  },
);
Icon.displayName = 'Icon';

export type { LucideProps };
export * as Icons from 'lucide-react';
