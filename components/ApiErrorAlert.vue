<script setup lang="ts">
import type { ApiErrorInfo } from '~/types/api'

const props = defineProps<{
  error?: ApiErrorInfo | string | null
}>()

const message = computed(() => (typeof props.error === 'string' ? props.error : props.error?.message || ''))
const requestId = computed(() => (typeof props.error === 'string' ? '' : props.error?.requestId || ''))
const code = computed(() => (typeof props.error === 'string' ? '' : props.error?.code || ''))
</script>

<template>
  <div v-if="message" class="alert">
    <strong>{{ message }}</strong>
    <div v-if="code || requestId" style="margin-top: 6px; font-size: 12px;">
      <span v-if="code">Код: {{ code }}</span>
      <span v-if="code && requestId"> · </span>
      <span v-if="requestId">requestId: {{ requestId }}</span>
    </div>
  </div>
</template>
