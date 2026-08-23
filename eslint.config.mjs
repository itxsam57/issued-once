import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    // Owner-only artwork URLs may be short-lived/provider-backed. Render them directly
    // instead of routing private production art through the public Next image optimizer.
    files: ['src/components/ops/DesignerPanel.tsx', 'src/components/ops/OpsConsole.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
