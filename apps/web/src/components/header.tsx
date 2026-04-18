/**
 * Brand header. Renders the "UD" mark, the full product name, the
 * "by CT4nk3r" subtitle, primary nav, and a theme toggle.
 */
import { Link, useRouterState } from '@tanstack/react-router';
import { Moon, Sun, Laptop } from 'lucide-react';
import clsx from 'clsx';
import { useSettings, type Theme } from '@/lib/settings-store';

const NAV: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/', label: 'Download' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
];

const THEMES: ReadonlyArray<{ value: Theme; icon: typeof Sun; label: string }> = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Laptop, label: 'System' },
];

export function Header(): JSX.Element {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent font-bold text-white"
          >
            UD
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Universal Downloader</span>
            <span className="text-xs text-muted">by CT4nk3r</span>
          </span>
        </Link>

        <nav className="ml-4 flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              item.to === '/' ? path === '/' : path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted hover:bg-card hover:text-fg',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div
          role="group"
          aria-label="Theme"
          className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5"
        >
          {THEMES.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              aria-label={`${label} theme`}
              title={label}
              onClick={() => setTheme(value)}
              className={clsx(
                'flex h-7 w-7 items-center justify-center rounded transition-colors',
                theme === value
                  ? 'bg-accent text-white'
                  : 'text-muted hover:bg-card hover:text-fg',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
