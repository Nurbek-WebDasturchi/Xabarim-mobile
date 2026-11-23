// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    rules: {
      // App data loaders and controlled form state intentionally synchronize in effects.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
