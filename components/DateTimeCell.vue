<script setup lang="ts">
const props = defineProps<{
  value?: unknown
}>()

const text = computed(() => formatDateTime(props.value))
</script>

<template>
  <span>{{ text || '—' }}</span>
</template>
