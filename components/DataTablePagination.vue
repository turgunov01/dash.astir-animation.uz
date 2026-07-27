<script setup lang="ts">
// Reusable DataTables-style pager: page-size selector, "showing X–Y of Z",
// numbered pages with ellipsis, and first/prev/next/last controls.
const props = withDefaults(defineProps<{
  page: number
  total: number
  limit: number
  // Optional override for endpoints whose total is unreliable (bare arrays).
  hasNext?: boolean
  pageSizeOptions?: number[]
}>(), {
  hasNext: undefined,
  pageSizeOptions: () => [10, 20, 50, 100]
})

const emit = defineEmits<{
  'update:page': [value: number]
  'update:limit': [value: number]
}>()

const totalPages = computed(() => Math.max(1, Math.ceil((props.total || 0) / Math.max(props.limit, 1))))
const rangeStart = computed(() => (props.total <= 0 ? 0 : (props.page - 1) * props.limit + 1))
const rangeEnd = computed(() => {
  const end = props.page * props.limit
  return props.total > 0 ? Math.min(end, props.total) : end
})
const canPrev = computed(() => props.page > 1)
const canNext = computed(() => props.page < totalPages.value || props.hasNext === true)

// Windowed page list, e.g. 1 … 4 5 [6] 7 8 … 20
const pages = computed<Array<number | 'gap'>>(() => {
  const last = totalPages.value
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1)

  const current = props.page
  const result: Array<number | 'gap'> = [1]
  const from = Math.max(2, current - 1)
  const to = Math.min(last - 1, current + 1)

  if (from > 2) result.push('gap')
  for (let page = from; page <= to; page += 1) result.push(page)
  if (to < last - 1) result.push('gap')
  result.push(last)

  return result
})

function go(target: number) {
  const clamped = Math.max(1, Math.min(target, Math.max(totalPages.value, target)))
  if (clamped !== props.page) emit('update:page', clamped)
}

function changeLimit(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (Number.isFinite(value) && value > 0) emit('update:limit', value)
}
</script>

<template>
  <div class="dt-pagination">
    <div class="dt-info">
      <span class="dt-range">Показано {{ rangeStart }}–{{ rangeEnd }} из {{ total }}</span>
      <label class="dt-pagesize">
        <span>На странице:</span>
        <select class="select" :value="limit" @change="changeLimit">
          <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
    </div>

    <div class="dt-pages">
      <button class="dt-btn" type="button" title="Первая" :disabled="!canPrev" @click="go(1)">«</button>
      <button class="dt-btn" type="button" title="Назад" :disabled="!canPrev" @click="go(page - 1)">‹</button>

      <template v-for="(entry, index) in pages" :key="`${entry}-${index}`">
        <span v-if="entry === 'gap'" class="dt-gap">…</span>
        <button v-else class="dt-btn" :class="{ active: entry === page }" type="button" @click="go(entry)">
          {{ entry }}
        </button>
      </template>

      <button class="dt-btn" type="button" title="Вперёд" :disabled="!canNext" @click="go(page + 1)">›</button>
      <button class="dt-btn" type="button" title="Последняя" :disabled="page >= totalPages" @click="go(totalPages)">»</button>
    </div>
  </div>
</template>

<style scoped>
.dt-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
}

.dt-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}

.dt-range {
  color: var(--muted);
  font-size: 13px;
}

.dt-pagesize {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
}

.dt-pagesize .select {
  width: auto;
  min-width: 64px;
  padding: 4px 8px;
}

.dt-pages {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.dt-btn {
  min-width: 34px;
  height: 34px;
  padding: 0 8px;
  border: 1px solid var(--border, #2a2d36);
  border-radius: 8px;
  background: var(--surface, transparent);
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: background 130ms ease, border-color 130ms ease, color 130ms ease;
}

.dt-btn:hover:not(:disabled) {
  border-color: var(--primary, #10b981);
}

.dt-btn.active {
  background: var(--primary, #10b981);
  border-color: var(--primary, #10b981);
  color: var(--primary-contrast, #04140d);
}

.dt-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dt-gap {
  padding: 0 4px;
  color: var(--muted);
}
</style>
