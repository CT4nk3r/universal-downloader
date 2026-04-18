import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../components/input.js';

describe('Input', () => {
  it('renders with type=text by default', () => {
    render(<Input placeholder="Name" />);
    const input = screen.getByPlaceholderText('Name');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  it('honors explicit type prop', () => {
    render(<Input type="email" placeholder="Email" />);
    expect(screen.getByPlaceholderText('Email')).toHaveAttribute('type', 'email');
  });

  it('forwards ref to underlying input', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('merges className', () => {
    render(<Input className="my-input" data-testid="i" />);
    expect(screen.getByTestId('i').className).toContain('my-input');
  });

  it('emits onChange events as user types', async () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} placeholder="x" />);
    await userEvent.type(screen.getByPlaceholderText('x'), 'ab');
    expect(onChange).toHaveBeenCalled();
  });

  it('respects disabled', () => {
    render(<Input disabled placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toBeDisabled();
  });

  it('supports controlled value', () => {
    render(<Input value="hello" readOnly />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });
});
