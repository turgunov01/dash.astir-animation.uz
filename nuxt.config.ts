export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  devtools: { enabled: true },
  experimental: {
    viteEnvironmentApi: true
  },
  modules: ['@nuxt/ui', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'https://test-api.astir-animation.uz',
      apiLogsEndpoint: process.env.NUXT_PUBLIC_API_LOGS_ENDPOINT || '/api/v1/admin/logs'
    }
  },
  app: {
    head: {
      title: 'Astir Admin',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'Internal admin dashboard for the Astir kids streaming platform.'
        }
      ]
    }
  }
})
