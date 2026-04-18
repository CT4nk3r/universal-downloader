import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../index.js';
import { Button } from '../components/button.js';
import { Badge } from '../components/badge.js';
import { Progress } from '../components/progress.js';

/**
 * NOTE: A standalone `JobCard` component is not yet exported from
 * `@universal-downloader/ui`. These tests pin the *expected composition*
 * built from existing primitives (Card + Badge + Progress + Button) so that
 * when JobCard is later extracted, behavior parity can be verified by simply
 * swapping the local fixture for the real component.
 */

interface JobCardFixtureProps {
  title: string;
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  onCancel?: () => void;
}

function JobCardFixture({ title, status, progress, onCancel }: JobCardFixtureProps) {
  return (
    <Card data-testid="job-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          <Badge>{status}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={progress} />
      </CardContent>
      <CardFooter>
        {onCancel ? (
          <Button variant="destructive" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

describe('JobCard (composition)', () => {
  it('renders title, status badge and progress', () => {
    render(<JobCardFixture title="My download" status="running" progress={37} />);
    expect(screen.getByText('My download')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '37');
  });

  it('omits the cancel button when onCancel is not provided', () => {
    render(<JobCardFixture title="x" status="done" progress={100} />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('invokes onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(
      <JobCardFixture title="x" status="running" progress={10} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders distinct status values', () => {
    const { rerender } = render(
      <JobCardFixture title="t" status="queued" progress={0} />,
    );
    expect(screen.getByText('queued')).toBeInTheDocument();
    rerender(<JobCardFixture title="t" status="error" progress={0} />);
    expect(screen.getByText('error')).toBeInTheDocument();
  });
});
