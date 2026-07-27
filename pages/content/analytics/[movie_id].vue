<script setup lang="ts">
definePageMeta({ roles: ['admin', 'super_admin'] })

const route = useRoute()
const api = useApi()

const movieId = computed(() => String(route.params.movie_id || ''))

const activeTab = ref('overview')
const tabs = [
  { key: 'overview', label: 'Обзор' },
  { key: 'audience', label: 'Аудитория' },
  { key: 'engagement', label: 'Вовлечённость' }
]

const kpis = [
  { title: 'Просмотры', icon: 'i-lucide-eye' },
  { title: 'Время просмотра', icon: 'i-lucide-clock' },
  { title: 'Ср. досмотр', icon: 'i-lucide-activity' },
  { title: 'Лайки', icon: 'i-lucide-thumbs-up' },
  { title: 'Комментарии', icon: 'i-lucide-message-square' }
]

// Best-effort content title so the header is meaningful. Data panels stay empty
// on purpose — this is a scaffold; the analytics data will be wired up later.
const { data: title } = await useAsyncData(`analytics-title-${movieId.value}`, async () => {
  try {
    const response = await api.get<Record<string, unknown>>(`/v1/content/movies/${encodeURIComponent(movieId.value)}`)
    const payload = (response?.data as Record<string, unknown>) ?? response
    return pickLocalized(getObjectValue(payload, 'title')) || String(getObjectValue(payload, 'name') || '')
  } catch {
    return ''
  }
})
</script>

<template>
  <section class="analytics-page">
    <div class="page-header">
      <div>
        <NuxtLink class="button secondary small-action analytics-back" to="/content/movies">
          <AppIcon name="i-lucide-chevron-left" />
          К каталогу
        </NuxtLink>
        <h1 class="page-title">Аналитика контента</h1>
        <p class="page-description">
          {{ title || 'Контент' }} <span class="analytics-id">· {{ movieId }}</span>
        </p>
      </div>
    </div>

    <div class="alert analytics-notice">
      <AppIcon name="i-lucide-info" />
      Каркас страницы аналитики (в стиле YouTube Studio). Данные подключим позже.
    </div>

    <div class="analytics-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="analytics-tab"
        :class="{ active: activeTab === tab.key }"
        type="button"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="analytics-kpis">
      <MetricCard v-for="kpi in kpis" :key="kpi.title" :title="kpi.title" value="—" :icon="kpi.icon" />
    </div>

    <div class="panel analytics-chart">
      <div class="panel-header">
        <h2 class="analytics-chart-title">Динамика просмотров</h2>
        <span class="badge neutral">скоро</span>
      </div>
      <div class="panel-body analytics-chart-body">
        <div class="analytics-placeholder">
          <AppIcon name="i-lucide-line-chart" />
          <strong>График появится здесь</strong>
          <p>Просмотры, время просмотра и удержание аудитории по дням.</p>
        </div>
      </div>
    </div>

    <div class="analytics-lower">
      <div class="panel">
        <div class="panel-header">
          <h2 class="analytics-chart-title">Удержание аудитории</h2>
          <span class="badge neutral">скоро</span>
        </div>
        <div class="panel-body analytics-chart-body">
          <div class="analytics-placeholder">
            <AppIcon name="i-lucide-area-chart" />
            <p>Кривая досмотра по таймкоду видео.</p>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h2 class="analytics-chart-title">Вовлечённость</h2>
          <span class="badge neutral">скоро</span>
        </div>
        <div class="panel-body analytics-chart-body">
          <div class="analytics-placeholder">
            <AppIcon name="i-lucide-pie-chart" />
            <p>Лайки, дизлайки и комментарии во времени.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.analytics-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.analytics-back {
  margin-bottom: 8px;
}

.analytics-id {
  color: var(--muted);
}

.analytics-notice {
  display: flex;
  align-items: center;
  gap: 8px;
}

.analytics-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border, #2a2d36);
}

.analytics-tab {
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: 10px 14px;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
}

.analytics-tab.active {
  color: var(--primary, #10b981);
  border-bottom-color: var(--primary, #10b981);
}

.analytics-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 16px;
}

.analytics-lower {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.analytics-chart-title {
  margin: 0;
  font-size: 16px;
}

.analytics-chart-body {
  min-height: 220px;
  display: grid;
  place-items: center;
}

.analytics-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  color: var(--muted);
  padding: 24px;
}

.analytics-placeholder :deep(svg),
.analytics-placeholder :deep(.iconify) {
  width: 40px;
  height: 40px;
  opacity: 0.5;
}

.analytics-placeholder strong {
  color: var(--text, inherit);
}

.analytics-placeholder p {
  margin: 0;
  max-width: 340px;
  font-size: 13px;
}
</style>
