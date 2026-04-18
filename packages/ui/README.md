# @universal-downloader/ui

Shared React component library for the Universal Downloader web and desktop apps. Mobile (`apps/mobile`) consumes only the design tokens via `@universal-downloader/ui/tokens` and reimplements visuals on React Native primitives.

## Installation (workspace consumers)

`apps/web` and `apps/desktop`:

```ts
// 1. Import the base styles once at app entry
import '@universal-downloader/ui/styles.css';

// 2. Use components
import { Button, Card, useToast, Toaster } from '@universal-downloader/ui';
```

Wrap the app in `<Toaster>` to enable toast notifications:

```tsx
import { Toaster } from '@universal-downloader/ui';

export function App() {
  return (
    <Toaster>
      <YourRoutes />
    </Toaster>
  );
}
```

### Tailwind setup

Make sure your Tailwind `content` includes the package source so utility classes get picked up:

```js
// tailwind.config.js
export default {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
};
```

## Tokens (RN consumer)

`apps/mobile` does not import React DOM components. Instead, read tokens:

```ts
import { tokens, colors, spacing, radii } from '@universal-downloader/ui/tokens';
```

Or read the raw JSON at build time:

```ts
import tokens from '@universal-downloader/ui/tokens.json';
```

## Exports

### `@universal-downloader/ui`

Utilities:

- `cn(...inputs)`

Tokens (re-exported for convenience):

- `tokens`, `colors`, `spacing`, `radii`, `fontSizes`, `fontWeights`, `shadows`
- types: `Tokens`, `Colors`, `Spacing`, `Radii`, `FontSizes`, `FontWeights`, `Shadows`

Components:

- `Button`, `buttonVariants` — variants: `primary | secondary | ghost | destructive`; sizes: `sm | md | lg | icon`
- `Input`
- `Textarea`
- `Select`
- `Slider`
- `Switch`
- `Checkbox`
- `RadioGroup`, `RadioItem`, `useRadioGroup`
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- `Badge`, `badgeVariants` — variants: `default | success | warning | destructive | info`
- `Progress`
- `Dialog`, `DialogTitle`, `DialogDescription`
- `Tooltip`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Separator`
- `Skeleton`
- `Toast`, `toastVariants`
- `Toaster`, `useToast`
- `Icon`, `Icons` (re-export of `lucide-react` namespace)
- `ThemeToggle`

All components forward refs and expose typed prop interfaces, e.g. `ButtonProps`, `ButtonVariantProps`, etc.

### `@universal-downloader/ui/tokens`

- `tokens` (default + named) — full token tree
- `colors`, `spacing`, `radii`, `fontSizes`, `fontWeights`, `shadows`
- types: `Tokens`, `Colors`, `Spacing`, `Radii`, `FontSizes`, `FontWeights`, `Shadows`

### `@universal-downloader/ui/styles.css`

Tailwind base directives + CSS variables driving the dark-mode-aware theme.

### `@universal-downloader/ui/tokens.json`

Raw JSON token tree for non-TS consumers (RN build scripts, native theming).

## Scripts

- `pnpm --filter @universal-downloader/ui build` — emit declarations & JS to `dist/`
- `pnpm --filter @universal-downloader/ui storybook` — local Storybook on port 6006
- `pnpm --filter @universal-downloader/ui test` — Vitest
- `pnpm --filter @universal-downloader/ui typecheck`
