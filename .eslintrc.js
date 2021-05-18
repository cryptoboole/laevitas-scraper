module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true
  },
  extends: 'eslint:recommended',
  globals: {
    document: 'readonly',
  },
  parserOptions: {
      ecmaVersion: 12
  },
  rules: {
    'padded-blocks': 0,
    'no-console': 0,
    'one-var': 0,
    'no-multi-spaces': 0,
    'no-plusplus': 0,
    'consistent-return': 0,
  }
};
