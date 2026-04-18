import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge.js';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'Badge' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'destructive', 'info'],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;
export const Default: Story = {};
export const Success: Story = { args: { variant: 'success', children: 'Done' } };
export const Destructive: Story = { args: { variant: 'destructive', children: 'Failed' } };
