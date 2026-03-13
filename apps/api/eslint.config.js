import tseslint from 'typescript-eslint'
import { config as nodeConfig } from '@repo/eslint-config/node'

export default tseslint.config(
  ...nodeConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
)
