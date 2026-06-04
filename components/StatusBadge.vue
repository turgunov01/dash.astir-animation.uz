<script setup lang="ts">
const props = defineProps<{
  value?: unknown
}>()

const normalized = computed(() => String(props.value ?? '').toLowerCase())
const normalizedBase = computed(() => normalized.value.replace(/\s+\d+%$/, ''))

const label = computed(() => {
  const labels: Record<string, string> = {
    active: 'Активен',
    inactive: 'Неактивен',
    pending: 'Ожидает',
    queued: 'В очереди',
    waiting: 'В очереди',
    uploaded: 'В очереди',
    processing: 'Обработка',
    in_progress: 'Обработка',
    transcoding: 'Обработка',
    ready: 'Готово',
    done: 'Готово',
    completed: 'Готово',
    complete: 'Готово',
    approved: 'Одобрен',
    expired: 'Истек',
    cancelled: 'Отменен',
    canceled: 'Отменен',
    grace_period: 'Льготный период',
    premium: 'Premium',
    free: 'Free',
    admin: 'Admin',
    super_admin: 'Super admin',
    parent: 'Parent',
    true: 'Да',
    false: 'Нет'
  }

  const raw = String(props.value ?? '—')
  const suffix = raw.match(/\s+\d+%$/)?.[0] || ''
  return labels[normalizedBase.value] ? `${labels[normalizedBase.value]}${suffix}` : raw
})

const tone = computed(() => {
  if (
    ['active', 'approved', 'premium', 'admin', 'super_admin', 'true', 'ready', 'done', 'completed', 'complete', 'готово'].includes(normalizedBase.value)
  ) return 'success'
  if (
    ['pending', 'queued', 'waiting', 'uploaded', 'processing', 'in_progress', 'transcoding', 'grace_period', 'обработка', 'в очереди'].includes(normalizedBase.value)
  ) return 'warning'
  if (['inactive', 'expired', 'cancelled', 'canceled', 'false', 'ошибка'].includes(normalizedBase.value)) return 'danger'
  return 'neutral'
})
</script>

<template>
  <span class="badge" :class="tone">{{ label }}</span>
</template>
