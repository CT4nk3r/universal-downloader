import type { Meta, StoryObj } from '@storybook/react';
import { Progress } from './progress.js';

const meta: Meta<typeof Progress> = {
  title: 'Components/Progress',
  component: Progress,
  args: { value: 42 },
};
export default meta;

type Story = StoryObj<typeof Progress>;
export const Default: Story = {};
export const Complete: Story = { args: { value: 100 } };
export const Indeterminate: Story = { args: { indeterminate: true } };
