// Flat ESLint config (ESLint 9).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      '.turbo',
      'coverage',
      // Build/tooling config files are not in tsconfig.json's `include` and
      // cannot be parsed with the type-aware parser. Skip linting them.
      '*.config.js',
      '*.config.ts',
      '*.config.cjs',
      '*.config.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
);
