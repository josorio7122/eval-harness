import tseslint from 'typescript-eslint'
import { config as reactViteConfig } from '@repo/eslint-config/react-vite'

export default tseslint.config(
  ...reactViteConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
)
