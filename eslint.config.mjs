import globals from 'globals';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'no-empty': 'off',
      'no-undef': 'off'
    }
  }
];
