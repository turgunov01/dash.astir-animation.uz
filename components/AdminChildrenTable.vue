<script setup lang="ts">
import type { ApiErrorInfo, ResourceDefinition } from '~/types/api'

const props = defineProps<{
  definition: ResourceDefinition
}>()

const api = useApi()
const search = ref('')
const filterValues = ref<Record<string, unknown>>({})
const page = ref(1)
const limit = 20
const rows = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const deleting = ref(false)
const error = ref<ApiErrorInfo | string | null>(null)
const warning = ref('')
const deleteTarget = ref<Record<string, unknown> | null>(null)

const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase()
  const status = String(filterValues.value.status || '')

  return rows.value.filter((row) => {
    if (status) {
      const active = normalizeBoolean(getResourceValue(row, 'active'))
      if (status === 'active' && !active) return false
      if (status === 'inactive' && active) return false
    }

    if (!query) return true

    return [
      getResourceValue(row, 'id'),
      getResourceValue(row, 'name'),
      getResourceValue(row, 'parent_id'),
      getResourceValue(row, 'parent.id'),
      getResourceValue(row, 'parent.email'),
      getResourceValue(row, 'parent.name'),
      getResourceValue(row, 'parent.phone')
    ].some((value) => String(value || '').toLowerCase().includes(query))
  })
})

const pageRows = computed(() => {
  const start = (page.value - 1) * limit
  return filteredRows.value.slice(start, start + limit)
})

const total = computed(() => filteredRows.value.length)
const hasNextPage = computed(() => page.value * limit < total.value)

watch([search, filterValues], () => {
  page.value = 1
}, { deep: true })

onMounted(load)

async function load() {
  loading.value = true
  error.value = null
  warning.value = ''

  try {
    const parents = await loadParents()
    const failedParents: string[] = []
    const childGroups = await mapWithConcurrency(parents, 8, async (parent) => {
      const parentId = getItemId(parent)
      if (parentId === undefined) return []

      try {
        const response = await api.get(`/api/v1/users/${encodeURIComponent(String(parentId))}/children`)
        return normalizeList(response, 'children').items.map((child) => withParent(child, parent))
      } catch {
        failedParents.push(String(parentId))
        return []
      }
    })

    rows.value = childGroups.flat().sort(compareChildren)
    if (failedParents.length) {
      warning.value = `Не удалось загрузить детей для ${failedParents.length} родител${failedParents.length === 1 ? 'я' : 'ей'}.`
    }
    page.value = 1
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
    rows.value = []
  } finally {
    loading.value = false
  }
}

async function loadParents() {
  const parents: Record<string, unknown>[] = []
  const pageSize = 100
  let offset = 0
  let totalParents: number | undefined

  for (let pageIndex = 0; pageIndex < 100; pageIndex++) {
    const response = await api.get('/api/v1/users', {
      role: 'parent',
      limit: pageSize,
      offset
    })
    const normalized = normalizeList(response, 'users')
    parents.push(...normalized.items)
    totalParents = normalized.total ?? totalParents

    if (!normalized.items.length) break
    offset += pageSize
    if (totalParents !== undefined && offset >= totalParents) break
    if (totalParents === undefined && normalized.items.length < pageSize) break
  }

  return parents
}

function withParent(child: Record<string, unknown>, parent: Record<string, unknown>) {
  const parentId = getItemId(parent)
  const childParentId = getResourceValue(child, 'parent_id') ?? getResourceValue(child, 'parentId') ?? parentId

  return {
    ...child,
    parent_id: childParentId,
    parentId: childParentId,
    parent: {
      ...parent,
      id: parentId
    }
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return

  const childId = getItemId(deleteTarget.value, props.definition.idKey)
  const parentId =
    getResourceValue(deleteTarget.value, 'parent_id') ??
    getResourceValue(deleteTarget.value, 'parentId') ??
    getResourceValue(deleteTarget.value, 'parent.id')

  if (childId === undefined || parentId === undefined) {
    error.value = 'Не удалось определить parent_id или child_id для удаления.'
    return
  }

  deleting.value = true
  error.value = null

  try {
    await api.remove(`/api/v1/users/${encodeURIComponent(String(parentId))}/children/${encodeURIComponent(String(childId))}`)
    deleteTarget.value = null
    await load()
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    deleting.value = false
  }
}

function rowRoute(row: Record<string, unknown>) {
  const id = getItemId(row, props.definition.idKey)
  if (!props.definition.detailRoute || id === undefined) return ''

  const parentId = getResourceValue(row, 'parent_id') ?? getResourceValue(row, 'parentId') ?? getResourceValue(row, 'parent.id')
  const path = `${props.definition.detailRoute}/${encodeURIComponent(String(id))}`
  return parentId === undefined || parentId === null || parentId === ''
    ? path
    : `${path}?parentId=${encodeURIComponent(String(parentId))}`
}

function parentRoute(row: Record<string, unknown>) {
  const parentId = getResourceValue(row, 'parent_id') ?? getResourceValue(row, 'parent.id')
  return parentId !== undefined ? `/users/${encodeURIComponent(String(parentId))}` : ''
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'active'].includes(normalized)) return true
    if (['false', '0', 'no', 'inactive'].includes(normalized)) return false
  }

  return Boolean(value)
}

function compareChildren(a: Record<string, unknown>, b: Record<string, unknown>) {
  const aCreated = new Date(String(getResourceValue(a, 'created_at') || getResourceValue(a, 'createdAt') || 0)).getTime()
  const bCreated = new Date(String(getResourceValue(b, 'created_at') || getResourceValue(b, 'createdAt') || 0)).getTime()
  return bCreated - aCreated
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ definition.title }}</h1>
        <p v-if="definition.description" class="page-description">{{ definition.description }}</p>
      </div>
    </div>

    <div class="panel">
      <div class="panel-body">
        <DataTableToolbar
          v-model:search="search"
          v-model:filter-values="filterValues"
          :filters="definition.filters || []"
          @refresh="load"
        />

        <ApiErrorAlert :error="error" />
        <div v-if="warning" class="alert">{{ warning }}</div>

        <div v-if="loading" class="loading-state">Загрузка данных...</div>
        <div v-else-if="!pageRows.length" class="empty-state">
          <div>
            <strong>Нет данных</strong>
            <p style="margin: 6px 0 0;">Дети не найдены по текущим фильтрам.</p>
          </div>
        </div>

        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th v-for="column in definition.columns" :key="column.key">{{ column.label }}</th>
                <th style="width: 1%;">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in pageRows" :key="String(getItemId(row, definition.idKey) || JSON.stringify(row))">
                <td v-for="column in definition.columns" :key="column.key">
                  <StatusBadge v-if="column.kind === 'status'" :value="getResourceValue(row, column.key)" />
                  <StatusBadge v-else-if="column.kind === 'boolean' && getResourceValue(row, column.key) !== undefined" :value="normalizeBoolean(getResourceValue(row, column.key))" />
                  <span v-else-if="column.kind === 'boolean'">-</span>
                  <DateTimeCell v-else-if="column.kind === 'date'" :value="getResourceValue(row, column.key)" />
                  <span v-else>{{ formatCellValue(row, column) || '-' }}</span>
                </td>
                <td>
                  <div style="display: flex; gap: 6px;">
                    <NuxtLink v-if="rowRoute(row)" class="button secondary icon" :to="rowRoute(row)" title="Открыть ребенка">
                      <AppIcon name="i-lucide-eye" />
                    </NuxtLink>
                    <NuxtLink v-if="parentRoute(row)" class="button secondary icon" :to="parentRoute(row)" title="Открыть родителя">
                      <AppIcon name="i-lucide-user" />
                    </NuxtLink>
                    <button
                      class="button secondary icon"
                      type="button"
                      title="Удалить"
                      @click="deleteTarget = row"
                    >
                      <AppIcon name="i-lucide-trash-2" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px;">
          <span style="color: var(--muted); font-size: 13px;">Всего: {{ total }}</span>
          <div style="display: flex; gap: 8px;">
            <button class="button secondary" type="button" :disabled="page <= 1" @click="page--">Назад</button>
            <button class="button secondary" type="button" :disabled="!hasNextPage" @click="page++">Вперед</button>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDeleteModal
      :model-value="Boolean(deleteTarget)"
      :loading="deleting"
      @update:model-value="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </section>
</template>
