<script setup lang="ts">
import type { ApiErrorInfo } from '~/types/api'

definePageMeta({
  roles: ['admin', 'super_admin']
})

const api = useApi()

const { data, pending, error } = await useAsyncData('overview-metrics', async () => {
  const [
    users,
    children,
    movies,
    categories,
    series,
    subscriptions,
    transactions,
    supportChats,
    health
  ] = await Promise.all([
    safeCount('/api/v1/users'),
    safeCount('/api/v1/children'),
    safeCount('/v1/content/movies'),
    safeCount('/v1/content/categories'),
    safeCount('/api/v1/series'),
    safeCount('/api/v1/billing/subscriptions'),
    safeCount('/api/v1/billing/transactions'),
    safeCount('/api/v1/admin/support/chats'),
    safeHealth()
  ])

  return { users, children, movies, categories, series, subscriptions, transactions, supportChats, health }
})

async function safeCount(endpoint: string): Promise<number | string> {
  try {
    const response = await api.get(endpoint, { limit: 1 })
    return normalizeList(response).total ?? normalizeList(response).items.length
  } catch {
    return '—'
  }
}

async function safeHealth(): Promise<Record<string, unknown>> {
  try {
    return await api.get('/health')
  } catch (requestError) {
    return { status: 'down', message: (requestError as ApiErrorInfo).message }
  }
}
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">Overview</h1>
        <p class="page-description">
          Операционная сводка Astir: пользователи, дети, контент, подписки, платежи и поддержка из реальных backend endpoints.
        </p>
      </div>
    </div>

    <ApiErrorAlert v-if="error" :error="String(error)" />

    <div v-if="pending" class="loading-state">Загрузка метрик...</div>
    <template v-else>
      <div class="grid grid-4">
        <MetricCard title="Пользователи" :value="data?.users ?? '—'" icon="i-lucide-users" />
        <MetricCard title="Дети" :value="data?.children ?? '—'" icon="i-lucide-baby" tone="success" />
        <MetricCard title="Контент" :value="Number(data?.movies || 0) + Number(data?.categories || 0) + Number(data?.series || 0) || '—'" icon="i-lucide-film" />
        <MetricCard title="Support chats" :value="data?.supportChats ?? '—'" icon="i-lucide-message-square" tone="warning" />
      </div>

      <div class="grid grid-3" style="margin-top: 16px;">
        <MetricCard title="Подписки" :value="data?.subscriptions ?? '—'" icon="i-lucide-refresh-cw" />
        <MetricCard title="Транзакции" :value="data?.transactions ?? '—'" icon="i-lucide-receipt" />
        <div class="panel">
          <div class="panel-header">
            <div>
              <h2 style="margin: 0; font-size: 18px;">Health</h2>
              <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">GET /health</p>
            </div>
            <StatusBadge :value="data?.health?.status || 'unknown'" />
          </div>
          <div class="panel-body">
            <pre class="code">{{ JSON.stringify(data?.health, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top: 16px;">
        <div class="panel">
          <div class="panel-header">
            <h2 style="margin: 0; font-size: 18px;">Content mix</h2>
          </div>
          <div class="panel-body meta-list">
            <div class="meta-row"><span>Movies</span><strong>{{ data?.movies }}</strong></div>
            <div class="meta-row"><span>Series</span><strong>{{ data?.series }}</strong></div>
            <div class="meta-row"><span>Categories</span><strong>{{ data?.categories }}</strong></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <h2 style="margin: 0; font-size: 18px;">Recent admin events</h2>
          </div>
          <div class="panel-body empty-state" style="min-height: 180px;">
            Audit-log endpoint в ТЗ не указан. Виджет оставлен как read-only placeholder.
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
