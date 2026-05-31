<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name?: string
    size?: 'sm' | 'md' | 'lg'
    spin?: boolean
  }>(),
  {
    name: 'i-lucide-circle',
    size: 'md',
    spin: false
  }
)

const iconName = computed(() => props.name || 'i-lucide-circle')
</script>

<template>
  <UIcon :name="iconName" class="app-icon" :class="[`app-icon-${size}`, { 'app-icon-spin': spin }]" />
</template>
