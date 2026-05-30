import { defineConfig } from 'eslint/config'
import vue from 'eslint-plugin-vue'

export default defineConfig([
  {
    files: ['**/*.{ts,tsx,vue}'],
    plugins: {
      vue,
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
])