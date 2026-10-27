// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // Never lint build output or dependencies.
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    // Type-aware linting for application and test sources only.
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow intentionally-unused args/vars when prefixed with `_`
      // (e.g. the mandatory 4-arg Express error handler signature).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // supertest response bodies are typed `any`; relaxing the unsafe-* family
    // here keeps tests readable. Tightened with typed responses in the test pass.
    files: ['src/test/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Jest mocks frequently reference methods unbound (e.g. jest.mocked(obj.fn)).
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    // Config files run in Node (CommonJS); not part of the app's tsconfig.
    files: ['*.config.{js,cjs}', 'jest.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'readonly', require: 'readonly', process: 'readonly' },
    },
  },
  // Disable stylistic rules that conflict with Prettier. Keep last.
  eslintConfigPrettier,
);
