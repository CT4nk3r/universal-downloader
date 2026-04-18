/**
 * Global app layout. Applies theme, renders the brand header, and slots the
 * active route's content. Children come from the router's `<Outlet/>`.
 */
import { useEffect, type ReactNode } from 'react';
import { Header } from '@/components/header';
import { useSettings } from '@/lib/settings-store';
import { applyTheme, watchSystemTheme } from '@/lib/theme';

export function App({ children }: { children: ReactNode }): JSX.Element {
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    return watchSystemTheme(() => applyTheme('system'));
  }, [theme]);

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted">
        Universal Downloader by CT4nk3r
      </footer>
    </div>
  );
}
