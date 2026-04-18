import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Progress } from '../components/progress.js';

/**
 * The UI package exposes a `<Progress />` primitive (not yet a `<ProgressBar />`).
 * These tests cover its progressbar semantics.
 */
describe('Progress (ProgressBar)', () => {
  it('exposes progressbar role with default value=0', () => {
    render(<Progress />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });

  it('reflects value and max via aria attributes', () => {
    render(<Progress value={42} max={200} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemax', '200');
  });

  it('clamps width style between 0 and 100%', () => {
    const { rerender } = render(<Progress value={500} max={100} />);
    let inner = screen.getByRole('progressbar').firstElementChild as HTMLElement;
    expect(inner.style.width).toBe('100%');

    rerender(<Progress value={-10} max={100} />);
    inner = screen.getByRole('progressbar').firstElementChild as HTMLElement;
    expect(inner.style.width).toBe('0%');
  });

  it('renders 50% width for value=50/max=100', () => {
    render(<Progress value={50} />);
    const inner = screen.getByRole('progressbar').firstElementChild as HTMLElement;
    expect(inner.style.width).toBe('50%');
  });

  it('omits aria-valuenow and width style when indeterminate', () => {
    render(<Progress indeterminate />);
    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('aria-valuenow');
    const inner = bar.firstElementChild as HTMLElement;
    expect(inner.style.width).toBe('');
    expect(inner.className).toMatch(/animate-pulse/);
  });
});
