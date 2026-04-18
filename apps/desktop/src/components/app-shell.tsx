import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Download, Settings } from 'lucide-react';
import clsx from 'clsx';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  return (
    <div className="flex h-full">
      <aside className="w-56 border-r border-border bg-card p-4 flex flex-col gap-2">
        <h1 className="text-sm font-semibold text-muted px-2 mb-2">
          Universal Downloader
        </h1>
        <NavLink to="/" icon={<Download size={16} />} label="Downloads" />
        <NavLink
          to="/settings"
          icon={<Settings size={16} />}
          label="Settings"
        />
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}

function NavLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: ReactNode;
  label: string;
}): JSX.Element {
  return (
    <Link
      to={to}
      className={clsx(
        'flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-bg',
        '[&.active]:bg-bg [&.active]:text-accent',
      )}
      activeProps={{ className: 'active' }}
    >
      {icon}
      {label}
    </Link>
  );
}
