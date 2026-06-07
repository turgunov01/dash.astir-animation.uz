<script setup lang="ts">
import type { EndpointToolDefinition } from '~/types/api'

defineProps<{
  tool: EndpointToolDefinition
  context?: Record<string, unknown>
  redirectTo?: string
}>()

const emit = defineEmits<{
  success: [value: unknown]
}>()

const result = ref<unknown>(null)

function handleSuccess(value: unknown) {
  result.value = value
  emit('success', value)
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <div>
        <h2 style="margin: 0; font-size: 16px;">{{ tool.title }}</h2>
        <p v-if="tool.description" style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">
          {{ tool.description }}
        </p>
      </div>
      <StatusBadge :value="tool.method" />
    </div>
    <div class="panel-body">
      <ResourceForm
        :fields="tool.fields || []"
        :endpoint="tool.endpoint"
        :method="tool.method"
        :context="context || {}"
        :path-params="tool.pathParams || []"
        :background-redirect-to="redirectTo || ''"
        :background-label="tool.title"
        :background-result-route-base="redirectTo || ''"
        :submit-label="tool.danger ? 'Выполнить опасное действие' : 'Выполнить'"
        @success="handleSuccess"
      />
      <pre v-if="result" class="code" style="margin-top: 14px;">{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </div>
</template>
