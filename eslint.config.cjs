/* eslint-env node */
const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');
const prettier = require('eslint-config-prettier');

module.exports = [
  // O que ignorar
  { ignores: ['dist/**', 'node_modules/**', 'drizzle/migrations/**'] },

  // Regras base JS
  js.configs.recommended,

  // TS
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // Se quiser regras type-aware, adicione:
        // project: ['./tsconfig.json'],
        // tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    rules: {
      // Regras recomendadas TS (sem type-check pesado)
      ...tsPlugin.configs.recommended.rules,

      // Organização de imports
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // Desliga conflitos com Prettier
  prettier,
];
