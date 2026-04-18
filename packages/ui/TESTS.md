# UI package — test harness

This document lists the `package.json` deltas required to run the tests
under `src/__tests__/` and the new `vitest.config.ts`. **Not applied
automatically** — agent J2.7 is forbidden from modifying `package.json`.

## Scripts

The existing `test` / `test:watch` scripts already work:

```jsonc
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

No script changes required.

## devDependencies to add

```jsonc
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/user-event": "^14.5.2"
  }
}
```

Already present and sufficient:

- `@testing-library/react` ^16.0.1
- `jsdom` ^25.0.1
- `vitest` ^2.1.2
- `react` / `react-dom` 18.3.1
- `@types/react` / `@types/react-dom`

## Test layout

```
packages/ui/
  vitest.config.ts                      # jsdom + setupFiles
  src/__tests__/
    setup.ts                            # @testing-library/jest-dom + cleanup()
    Button.test.tsx
    Input.test.tsx
    ProgressBar.test.tsx                # exercises <Progress/> primitive
    JobCard.test.tsx                    # composition fixture (no JobCard yet)
    PresetPicker.test.tsx               # composition fixture (no PresetPicker yet)
    Toast.test.tsx
```

## Notes on missing components

- `JobCard` and `PresetPicker` are **not** yet exported from
  `@universal-downloader/ui` (see `src/index.ts`). The two test files build
  the *expected composition* from existing primitives (`Card` + `Badge` +
  `Progress` + `Button`, and `RadioGroup` + `RadioItem` respectively) so the
  contract can be pinned today. When the real components land, swap the
  local `*Fixture` for the export and the assertions should still hold.
- The pre-existing `src/components/button.test.tsx` is left untouched. The
  new `src/__tests__/Button.test.tsx` is the canonical, fuller test.
