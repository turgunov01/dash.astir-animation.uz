<script setup lang="ts">
const props = defineProps<{
  value: string
  label?: string
}>()

const copied = ref(false)

async function copy() {
  if (!process.client) return
  await navigator.clipboard.writeText(props.value)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1200)
}
</script>

<template>
  <button class="button secondary icon" type="button" :title="label || 'Скопировать'" @click="copy">
    <AppIcon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" />
  </button>
</template>
