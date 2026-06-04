<script setup lang="ts">
import type { ApiErrorInfo, RelatedEndpointDefinition, ResourceDefinition } from '~/types/api'

const props = defineProps<{
  definition: ResourceDefinition
  id: string | number
}>()

const api = useApi()
const item = ref<Record<string, unknown> | null>(null)
const related = ref<Record<string, Record<string, unknown>[]>>({})
const loading = ref(false)
const activeSaving = ref(false)
const error = ref<ApiErrorInfo | null>(null)

const context = computed(() => ({ id: props.id, ...(item.value || {}) }))
const isCategoryResource = computed(() => props.definition.key === 'categories')
const categoryActive = computed(() => normalizeBooleanValue(getResourceValue(item.value, 'active')))
const pageTitle = computed(() => {
  if (isCategoryResource.value) {
    return `Категория: ${pickLocalized(getResourceValue(item.value, 'title')) || 'Без названия'}`
  }

  if (props.definition.key === 'tags') {
    return `Тег: ${String(getResourceValue(item.value, 'name') || getResourceValue(item.value, 'slug') || 'Без названия')}`
  }

  if (props.definition.key === 'movies') {
    return `Фильм: ${pickLocalized(getResourceValue(item.value, 'title')) || 'Без названия'}`
  }

  if (props.definition.key === 'series') {
    return `Сериал: ${pickLocalized(getResourceValue(item.value, 'title')) || 'Без названия'}`
  }

  return `${props.definition.title} #${props.id}`
})

onMounted(load)

async function load() {
  if (!props.definition.detailEndpoint) return

  loading.value = true
  error.value = null

  try {
    const response = await api.get(resolveEndpoint(props.definition.detailEndpoint, { id: props.id }))
    item.value = unwrapPayload<Record<string, unknown>>(response, props.definition.key)
    await loadRelated()
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    loading.value = false
  }
}

async function loadRelated() {
  const entries = await Promise.all(
    (props.definition.related || []).map(async (entry) => {
      try {
        const response = await api.get(resolveEndpoint(entry.endpoint, context.value))
        return [entry.title, normalizeList(response).items] as const
      } catch {
        return [entry.title, []] as const
      }
    })
  )
  related.value = Object.fromEntries(entries)
}

function columnsFor(entry: RelatedEndpointDefinition) {
  return entry.columns?.length ? entry.columns : [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Название' },
    { key: 'title', label: 'Title', kind: 'localized' as const },
    { key: 'status', label: 'Статус', kind: 'status' as const },
    { key: 'createdAt', label: 'Создан', kind: 'date' as const }
  ]
}

async function toggleCategoryActive() {
  if (!isCategoryResource.value || !props.definition.updateEndpoint || !item.value) return

  activeSaving.value = true
  error.value = null

  try {
    const metadata = buildCategoryMetadata(!categoryActive.value)
    const formData = new FormData()
    formData.append('metadata', JSON.stringify(metadata))

    await api.patch(resolveEndpoint(props.definition.updateEndpoint, context.value), formData)
    await load()
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    activeSaving.value = false
  }
}

function buildCategoryMetadata(active: boolean): Record<string, unknown> {
  const metadata: Record<string, unknown> = { active }

  for (const key of ['title', 'description', 'type', 'slug']) {
    const value = getResourceValue(item.value, key)
    if (value !== undefined && value !== null && value !== '') metadata[key] = value
  }

  return metadata
}

function normalizeBooleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'active'].includes(normalized)) return true
    if (['false', '0', 'no', 'inactive'].includes(normalized)) return false
  }

  return Boolean(value)
}
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <NuxtLink class="badge neutral" :to="definition.detailRoute || '/'">
          <AppIcon name="i-lucide-arrow-left" />
          Назад
        </NuxtLink>
        <h1 class="page-title" style="margin-top: 12px;">{{ pageTitle }}</h1>
        <p v-if="definition.description" class="page-description">{{ definition.description }}</p>
      </div>
      <div class="page-actions">
        <button
          v-if="isCategoryResource"
          class="category-toggle-button"
          :class="{ active: categoryActive }"
          type="button"
          role="switch"
          :aria-checked="categoryActive"
          :disabled="activeSaving"
          @click="toggleCategoryActive"
        >
          <span class="category-toggle-track">
            <span class="category-toggle-thumb" />
          </span>
          <span>{{ categoryActive ? 'Активна' : 'Неактивна' }}</span>
        </button>
        <button class="button secondary" type="button" @click="load">
          <AppIcon name="i-lucide-refresh-cw" />
          Обновить
        </button>
      </div>
    </div>

    <ApiErrorAlert :error="error" />
    <div v-if="loading" class="loading-state">Загрузка записи...</div>

    <div v-else-if="item" class="split-layout">
      <div class="grid">
        <MovieMediaPanel
          v-if="definition.key === 'movies'"
          :movie-id="id"
          :movie="item"
          @updated="load"
        />

        <SeriesPosterPanel
          v-if="definition.key === 'series'"
          :series-id="id"
          @updated="load"
        />

        <div v-if="definition.updateEndpoint && definition.formFields?.length" class="panel">
          <div class="panel-header">
            <div>
              <h2 style="margin: 0; font-size: 18px;">Редактирование</h2>
              <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">Форма отправляет изменения в backend endpoint.</p>
            </div>
          </div>
          <div class="panel-body">
            <ResourceForm
              :fields="definition.formFields"
              :initial-value="item"
              :endpoint="definition.updateEndpoint"
              :method="definition.updateMethod || 'PUT'"
              :context="context"
              :background-redirect-to="definition.detailRoute || ''"
              :background-label="`Обновление: ${definition.title}`"
              :background-result-route-base="definition.detailRoute || ''"
              :force-multipart="definition.updateSubmit?.forceMultipart || false"
              :metadata-key="definition.updateSubmit?.metadataKey || 'metadata'"
              :metadata-fields="definition.updateSubmit?.metadataFields || []"
              submit-label="Сохранить изменения"
              @success="load"
            />
          </div>
        </div>

        <MovieTagsPanel
          v-if="definition.key === 'movies'"
          :movie-id="id"
          :movie="item"
          @updated="load"
        />

        <EndpointTool
          v-for="tool in definition.tools || []"
          :key="tool.title"
          :tool="tool"
          :context="context"
          :redirect-to="definition.detailRoute || ''"
        />

        <div v-for="entry in definition.related || []" :key="entry.title" class="panel">
          <div class="panel-header">
            <div>
              <h2 style="margin: 0; font-size: 18px;">{{ entry.title }}</h2>
              <p v-if="entry.description" style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">
                {{ entry.description }}
              </p>
            </div>
          </div>
          <div class="panel-body">
            <div v-if="!related[entry.title]?.length" class="empty-state" style="min-height: 120px;">Нет связанных данных</div>
            <div v-else class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th v-for="column in columnsFor(entry)" :key="column.key">{{ column.label }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in related[entry.title]" :key="String(getItemId(row) || JSON.stringify(row))">
                    <td v-for="column in columnsFor(entry)" :key="column.key">
                      <StatusBadge v-if="column.kind === 'status'" :value="getResourceValue(row, column.key)" />
                      <DateTimeCell v-else-if="column.kind === 'date'" :value="getResourceValue(row, column.key)" />
                      <span v-else>{{ formatCellValue(row, column) || '—' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      <MetadataCard :item="item" />
    </div>
  </section>
</template>
