import config from '@remcohaszing/eslint'

export default [
  ...config,
  {
    files: ['**/*.md/*.js'],
    rules: {
      'n/no-extraneous-import': 'off'
    }
  }
]
