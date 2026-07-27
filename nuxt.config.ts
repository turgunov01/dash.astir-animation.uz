export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  devtools: { enabled: true },
  experimental: {
    viteEnvironmentApi: true
  },
  nitro: {
    preset: 'node-server'
  },
  modules: ['@nuxt/ui', '@pinia/nuxt', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Astir Admin',
      short_name: 'Astir',
      description: 'Astir kids streaming — admin dashboard',
      lang: 'ru',
      theme_color: '#0b0c0e',
      background_color: '#0b0c0e',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/'
    },
    // Generates all icon sizes (incl. maskable + apple-touch) from public/logo.svg.
    pwaAssets: {
      preset: 'minimal-2023',
      image: 'public/logo.svg'
    },
    workbox: {
      navigateFallback: '/',
      // Precache the app shell only. Admin API is cross-origin and must stay live.
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
      navigateFallbackDenylist: [/^\/api/]
    },
    // Serve the manifest + service worker in `nuxt dev` so it's installable locally.
    devOptions: {
      enabled: true,
      suppressWarnings: true,
      navigateFallback: '/',
      type: 'module'
    }
  },
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
      ],
      link: [
        // Establish the TLS connection to the API/media host early so posters
        // and data requests start with no connection-setup latency.
        { rel: 'preconnect', href: 'https://test-api.astir-animation.uz' },
        { rel: 'dns-prefetch', href: 'https://test-api.astir-animation.uz' }
      ]
    }
  }
})
