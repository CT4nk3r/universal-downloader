import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './card.js';
import { CardHeader, CardTitle, CardDescription } from './card-header.js';
import { CardContent } from './card-content.js';
import { CardFooter } from './card-footer.js';
import { Button } from './button.js';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Card title</CardTitle>
        <CardDescription>Short supporting copy.</CardDescription>
      </CardHeader>
      <CardContent>Body content goes here.</CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  ),
};
