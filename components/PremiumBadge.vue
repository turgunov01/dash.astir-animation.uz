<script setup lang="ts">
defineProps<{
  value?: unknown
}>()
</script>

<template>
  <span v-if="value" class="badge info">Premium</span>
  <span v-else class="badge neutral">Free</span>
</template>
