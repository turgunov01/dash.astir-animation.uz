<script setup lang="ts">
const props = defineProps<{
  value?: unknown
}>()

const normalized = computed(() => String(props.value ?? '').toLowerCase())

const label = computed(() => {
  const labels: Record<string, string> = {
    active: 'Активен',
    inactive: 'Неактивен',
    pending: 'Ожидает',
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

  return labels[normalized.value] || String(props.value ?? '—')
})

const tone = computed(() => {
  if (['active', 'approved', 'premium', 'admin', 'super_admin', 'true'].includes(normalized.value)) return 'success'
  if (['pending', 'grace_period'].includes(normalized.value)) return 'warning'
  if (['inactive', 'expired', 'cancelled', 'canceled', 'false'].includes(normalized.value)) return 'danger'
  return 'neutral'
})
</script>

<template>
  <span class="badge" :class="tone">{{ label }}</span>
</template>
