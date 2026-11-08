import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['app/types/openapi.d.ts', 'coverage/**', 'docs/evidence/**'],
  rules: { 'vue/multi-word-component-names': 'off' },
})
