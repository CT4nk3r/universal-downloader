import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast } from '../components/toast.js';

describe('Toast', () => {
  it('renders title and description with status role', () => {
    render(<Toast title="Saved" description="Your changes were saved." />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Your changes were saved.')).toBeInTheDocument();
  });

  it('renders children when no title/description provided', () => {
    render(
      <Toast>
        <span>Custom body</span>
      </Toast>,
    );
    expect(screen.getByText('Custom body')).toBeInTheDocument();
  });

  it('omits dismiss button when onDismiss is not supplied', () => {
    render(<Toast title="hi" />);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('renders dismiss button and fires onDismiss', async () => {
    const onDismiss = vi.fn();
    render(<Toast title="bye" onDismiss={onDismiss} />);
    const btn = screen.getByRole('button', { name: 'Dismiss' });
    await userEvent.click(btn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it.each(['default', 'success', 'warning', 'destructive', 'info'] as const)(
    'applies variant=%s class hint',
    (variant) => {
      render(<Toast variant={variant} title={variant} />);
      const toast = screen.getByRole('status');
      if (variant === 'default') {
        // default uses neutral border/bg tokens
        expect(toast.className).toMatch(/ud-border/);
      } else {
        expect(toast.className).toMatch(new RegExp(`ud-${variant}`));
      }
    },
  );

  it('merges custom className', () => {
    render(<Toast className="my-toast" title="t" />);
    expect(screen.getByRole('status').className).toContain('my-toast');
  });
});
