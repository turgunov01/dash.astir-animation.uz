<script setup lang="ts">
const props = defineProps<{
  movie?: Record<string, unknown> | null
}>()

const metrics = [
  { key: 'duration_sec', label: 'duration_sec' },
  { key: 'duration_minutes', label: 'duration_minutes' },
  { key: 'play_count', label: 'play_count' },
  { key: 'views_count', label: 'views_count' },
  { key: 'watch_time_sec', label: 'watch_time_sec' }
]

function metricValue(key: string): string {
  const value = getResourceValue(props.movie, key)
  if (value === undefined || value === null || value === '') return '—'

  if (typeof value === 'number') {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)
  }

  return String(value)
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <div>
        <h2 style="margin: 0; font-size: 18px;">Movie details</h2>
        <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">Backend playback and duration fields.</p>
      </div>
    </div>
    <div class="panel-body">
      <div class="meta-list">
        <div v-for="metric in metrics" :key="metric.key" class="meta-row">
          <span>{{ metric.label }}</span>
          <strong>{{ metricValue(metric.key) }}</strong>
        </div>
      </div>
    </div>
  </div>
</template>
