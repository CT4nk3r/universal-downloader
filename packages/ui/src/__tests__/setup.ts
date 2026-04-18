// Test setup for @universal-downloader/ui.
// Loaded via vitest `setupFiles` before each test file.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
