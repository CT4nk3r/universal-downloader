import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup } from '../components/radio-group.js';
import { RadioItem } from '../components/radio-item.js';

/**
 * NOTE: A standalone `PresetPicker` component is not yet exported from
 * `@universal-downloader/ui`. These tests pin the *expected composition*
 * built from the existing RadioGroup + RadioItem primitives.
 */

interface Preset {
  id: string;
  label: string;
}

interface PresetPickerFixtureProps {
  presets: Preset[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  disabled?: boolean;
}

function PresetPickerFixture({
  presets,
  value,
  defaultValue,
  onChange,
  disabled,
}: PresetPickerFixtureProps) {
  return (
    <RadioGroup
      aria-label="Preset"
      value={value}
      defaultValue={defaultValue}
      onValueChange={onChange}
      disabled={disabled}
    >
      {presets.map((p) => (
        <RadioItem key={p.id} value={p.id} label={p.label} />
      ))}
    </RadioGroup>
  );
}

const PRESETS: Preset[] = [
  { id: 'mp4-1080', label: 'MP4 1080p' },
  { id: 'mp4-720', label: 'MP4 720p' },
  { id: 'audio-mp3', label: 'Audio MP3' },
];

describe('PresetPicker (composition)', () => {
  it('renders one radio per preset under a radiogroup', () => {
    render(<PresetPickerFixture presets={PRESETS} />);
    expect(screen.getByRole('radiogroup', { name: 'Preset' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    for (const p of PRESETS) {
      expect(screen.getByLabelText(p.label)).toBeInTheDocument();
    }
  });

  it('honors defaultValue (uncontrolled)', () => {
    render(<PresetPickerFixture presets={PRESETS} defaultValue="mp4-720" />);
    expect(screen.getByLabelText('MP4 720p')).toBeChecked();
    expect(screen.getByLabelText('MP4 1080p')).not.toBeChecked();
  });

  it('reflects controlled value', () => {
    render(<PresetPickerFixture presets={PRESETS} value="audio-mp3" onChange={() => {}} />);
    expect(screen.getByLabelText('Audio MP3')).toBeChecked();
  });

  it('invokes onChange with selected preset id', async () => {
    const onChange = vi.fn();
    function Controlled() {
      const [v, setV] = useState<string | undefined>(undefined);
      return (
        <PresetPickerFixture
          presets={PRESETS}
          value={v}
          onChange={(id) => {
            setV(id);
            onChange(id);
          }}
        />
      );
    }
    render(<Controlled />);
    await userEvent.click(screen.getByLabelText('MP4 720p'));
    expect(onChange).toHaveBeenCalledWith('mp4-720');
  });

  it('disables every radio when group is disabled', () => {
    render(<PresetPickerFixture presets={PRESETS} disabled />);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });
});
