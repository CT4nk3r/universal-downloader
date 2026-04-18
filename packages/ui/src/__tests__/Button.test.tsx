import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../components/button.js';

describe('Button', () => {
  it('renders children and defaults to type=button', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: 'Click me' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('applies primary variant by default', () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole('button', { name: 'Default' });
    // primary variant uses --ud-primary token
    expect(btn.className).toMatch(/ud-primary/);
  });

  it('applies destructive variant classes', () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toMatch(
      /ud-destructive/,
    );
  });

  it.each(['sm', 'md', 'lg', 'icon'] as const)('applies size=%s', (size) => {
    render(<Button size={size}>x</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('forwards ref to underlying button element', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('merges custom className', () => {
    render(<Button className="extra-class">x</Button>);
    expect(screen.getByRole('button').className).toContain('extra-class');
  });

  it('respects disabled prop and skips clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Off
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Off' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fires onClick handler when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
