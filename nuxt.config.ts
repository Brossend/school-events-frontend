export default defineNuxtConfig({
  compatibilityDate: '2026-10-25',
  ssr: true,
  routeRules: {
    '/**': { ssr: false },
    '/login': { ssr: true },
    '/forgot-password': { ssr: true },
    '/register': { ssr: true },
  },
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@nuxt/eslint'],
  css: ['@fontsource-variable/inter', '~/assets/css/main.css', '~/assets/css/fe002.css', '~/assets/css/fe003.css', '~/assets/css/fe004.css', '~/assets/css/fe005.css', '~/assets/css/fe006.css', '~/assets/css/fe007.css', '~/assets/css/fe008.css', '~/assets/css/fe009.css', '~/assets/css/fe010.css', '~/assets/css/fe011.css', '~/assets/css/ux001.css'],
  components: [{ path: '~/components', pathPrefix: false }],
  runtimeConfig: {
    public: { apiOrigin: 'http://localhost:8000' },
  },
  typescript: { strict: true },
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Школьные события · Сбер × УрФУ',
      link: [{ rel: 'icon', href: '/favicon.ico', sizes: 'any' }, { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }, { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }, { rel: 'manifest', href: '/site.webmanifest' }],
      meta: [{ name: 'description', content: 'Платформа подготовки школьных мероприятий. Совместный образовательный проект Сбер × УрФУ.' }],
    },
  },
  eslint: { config: { stylistic: false } },
})
