export default defineNuxtConfig({
  compatibilityDate: '2026-10-25',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@nuxt/eslint'],
  css: ['@fontsource-variable/inter', '~/assets/css/main.css', '~/assets/css/fe002.css', '~/assets/css/fe003.css', '~/assets/css/fe004.css', '~/assets/css/fe005.css', '~/assets/css/fe006.css', '~/assets/css/fe007.css', '~/assets/css/fe008.css', '~/assets/css/fe009.css', '~/assets/css/fe010.css', '~/assets/css/fe011.css'],
  components: [{ path: '~/components', pathPrefix: false }],
  runtimeConfig: {
    public: { apiOrigin: 'http://localhost:8000' },
  },
  typescript: { strict: true },
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Школьные события · Сбер × УрФУ',
      meta: [{ name: 'description', content: 'Платформа подготовки школьных мероприятий. Совместный образовательный проект Сбер × УрФУ.' }],
    },
  },
  eslint: { config: { stylistic: false } },
})
