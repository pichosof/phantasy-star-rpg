/* eslint-env node */
const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');
const prettier = require('eslint-config-prettier');
const globals = require('globals');


module.exports = [
  // O que ignorar
  { ignores: ['dist/**', 'node_modules/**', 'drizzle/migrations/**'] },
{ languageOptions: { globals: { ...globals.node, ...globals.es2021 } } },

  

  // Regras base JS
  js.configs.recommended,

  // TS
  {
    files: ['**/*.ts', '**/*.tsx'],
  languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } },
  plugins: { '@typescript-eslint': tsPlugin, import: importPlugin },
     rules: {
    ...tsPlugin.configs.recommended.rules,
    'import/order': ['error', { 'newlines-between': 'always', alphabetize: { order: 'asc', caseInsensitive: true } }],
    '@typescript-eslint/consistent-type-imports': 'error',
    // deixe '@typescript-eslint/no-misused-promises': 'off' ou ative via bloco type-aware
    '@typescript-eslint/no-explicit-any': 'error'
  },
  },

  // Desliga conflitos com Prettier
  prettier,
];
