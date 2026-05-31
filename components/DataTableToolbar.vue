<script setup lang="ts">
import type { ResourceFilter } from '~/types/api'

const props = withDefaults(
  defineProps<{
    search?: string
    filters?: ResourceFilter[]
    filterValues?: Record<string, unknown>
  }>(),
  {
    search: '',
    filters: () => [],
    filterValues: () => ({})
  }
)

const emit = defineEmits<{
  'update:search': [value: string]
  'update:filterValues': [value: Record<string, unknown>]
  refresh: []
}>()

function setFilter(key: string, value: unknown) {
  emit('update:filterValues', {
    ...props.filterValues,
    [key]: value
  })
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-filters">
      <input
        class="input"
        style="max-width: 340px;"
        type="search"
        :value="search"
        placeholder="Поиск"
        @input="emit('update:search', ($event.target as HTMLInputElement).value)"
      >
      <template v-for="filter in filters" :key="filter.key">
        <select
          v-if="filter.type === 'select'"
          class="select"
          style="max-width: 220px;"
          :value="filterValues[filter.key] as string"
          @change="setFilter(filter.key, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ filter.label }}</option>
          <option v-for="option in filter.options || []" :key="String(option.value)" :value="String(option.value)">
            {{ option.label }}
          </option>
        </select>
        <input
          v-else
          class="input"
          style="max-width: 220px;"
          :placeholder="filter.label"
          :value="filterValues[filter.key] as string"
          @input="setFilter(filter.key, ($event.target as HTMLInputElement).value)"
        >
      </template>
    </div>
    <button class="button secondary icon" type="button" title="Обновить" @click="emit('refresh')">
      <AppIcon name="i-lucide-refresh-cw" />
    </button>
  </div>
</template>
