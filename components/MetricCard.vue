<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  description?: string
  icon?: string
  tone?: 'primary' | 'accent' | 'success' | 'warning'
}>()
</script>

<template>
  <div class="panel">
    <div class="panel-body" style="display: flex; gap: 14px; align-items: flex-start;">
      <div
        class="badge"
        :class="tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'info'"
        style="width: 40px; height: 40px; justify-content: center; border-radius: 8px;"
      >
        <AppIcon :name="icon || 'i-lucide-activity'" size="lg" />
      </div>
      <div>
        <p style="margin: 0; color: var(--muted); font-size: 13px; font-weight: 700;">{{ title }}</p>
        <p style="margin: 4px 0 0; font-size: 28px; font-weight: 800;">{{ value }}</p>
        <p v-if="description" style="margin: 6px 0 0; color: var(--muted); font-size: 13px;">
          {{ description }}
        </p>
      </div>
    </div>
  </div>
</template>
