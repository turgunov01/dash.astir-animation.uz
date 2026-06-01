<script setup lang="ts">
import type { ApiErrorInfo, ResourceDefinition } from '~/types/api'

const props = defineProps<{
  definition: ResourceDefinition
}>()

const api = useApi()
const uploadQueue = useUploadQueueStore()
const search = ref('')
const filterValues = ref<Record<string, unknown>>({})
const page = ref(1)
const limit = 20
const items = ref<Record<string, unknown>[]>([])
const total = ref(0)
const loading = ref(false)
const deleting = ref(false)
const error = ref<ApiErrorInfo | null>(null)
const deleteTarget = ref<Record<string, unknown> | null>(null)
const handledUploadTaskIds = new Set<string>()

const hasNextPage = computed(() => page.value * limit < total.value)

watch([search, filterValues, page], () => load(), { deep: true })
watch(
  () => uploadQueue.tasks.map((task) => `${task.id}:${task.status}:${task.completedAt || ''}`).join('|'),
  () => {
    const completed = uploadQueue.tasks.filter(
      (task) => task.status === 'success' && task.completedAt && !handledUploadTaskIds.has(task.id)
    )
    const shouldReload = completed.some((task) => isRelatedUploadEndpoint(task.endpoint))
    for (const task of completed) handledUploadTaskIds.add(task.id)
    if (shouldReload) void load()
  }
)
onMounted(load)

async function load() {
  if (!props.definition.listEndpoint) return

  loading.value = true
  error.value = null

  try {
    const response = await api.get(props.definition.listEndpoint, {
      search: search.value,
      page: page.value,
      limit,
      ...filterValues.value
    })
    const normalized = normalizeList(response)
    items.value = normalized.items
    total.value = normalized.total ?? normalized.items.length
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function rowRoute(row: Record<string, unknown>): string {
  const id = getItemId(row, props.definition.idKey)
  return props.definition.detailRoute && id !== undefined ? `${props.definition.detailRoute}/${id}` : ''
}

function openDelete(row: Record<string, unknown>) {
  deleteTarget.value = row
}

function isRelatedUploadEndpoint(endpoint: string): boolean {
  const candidates = [
    props.definition.createEndpoint,
    props.definition.updateEndpoint,
    ...(props.definition.tools || []).map((tool) => tool.endpoint)
  ].filter(Boolean) as string[]

  return candidates.some((candidate) => endpointMatches(candidate, endpoint))
}

function endpointMatches(template: string, endpoint: string): boolean {
  if (template === endpoint) return true

  const escaped = template
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{[^}]+\\\}/g, '[^/]+')
  return new RegExp(`^${escaped}$`).test(endpoint)
}

async function confirmDelete() {
  if (!deleteTarget.value || !props.definition.deleteEndpoint) return

  const id = getItemId(deleteTarget.value, props.definition.idKey)
  deleting.value = true

  try {
    await api.remove(resolveEndpoint(props.definition.deleteEndpoint, { id, ...deleteTarget.value }))
    deleteTarget.value = null
    await load()
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ definition.title }}</h1>
        <p v-if="definition.description" class="page-description">{{ definition.description }}</p>
      </div>
      <NuxtLink v-if="definition.createRoute" class="button" :to="definition.createRoute">
        <AppIcon name="i-lucide-plus" />
        Создать
      </NuxtLink>
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

        <div v-if="loading" class="loading-state">Загрузка данных...</div>
        <div v-else-if="!items.length" class="empty-state">
          <div>
            <strong>Нет данных</strong>
            <p style="margin: 6px 0 0;">Backend вернул пустой список или endpoint пока недоступен.</p>
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
              <tr v-for="row in items" :key="String(getItemId(row, definition.idKey) || JSON.stringify(row))">
                <td v-for="column in definition.columns" :key="column.key">
                  <StatusBadge v-if="column.kind === 'status'" :value="getObjectValue(row, column.key)" />
                  <PremiumBadge v-else-if="column.kind === 'premium'" :value="getObjectValue(row, column.key)" />
                  <StatusBadge v-else-if="column.kind === 'boolean'" :value="Boolean(getObjectValue(row, column.key))" />
                  <DateTimeCell v-else-if="column.kind === 'date'" :value="getObjectValue(row, column.key)" />
                  <span v-else>{{ formatCellValue(row, column) || '—' }}</span>
                </td>
                <td>
                  <div style="display: flex; gap: 6px;">
                    <NuxtLink v-if="rowRoute(row)" class="button secondary icon" :to="rowRoute(row)" title="Открыть">
                      <AppIcon name="i-lucide-eye" />
                    </NuxtLink>
                    <button
                      v-if="definition.deleteEndpoint"
                      class="button secondary icon"
                      type="button"
                      title="Удалить"
                      @click="openDelete(row)"
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
