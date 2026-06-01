<script setup lang="ts">
import type { ApiErrorInfo, ResourceDefinition } from '~/types/api'

const props = defineProps<{
  definition: ResourceDefinition
}>()

const api = useApi()
const uploadQueue = useUploadQueueStore()

const items = ref<Record<string, unknown>[]>([])
const total = ref(0)
const loading = ref(false)
const deleting = ref(false)
const error = ref<ApiErrorInfo | null>(null)
const deleteTarget = ref<Record<string, unknown> | null>(null)
const minAge = ref(0)
const maxAge = ref(18)
const likedOnly = ref(false)
const selectedTags = ref<string[]>([])
const fileInputs = ref<Record<string, HTMLInputElement | null>>({})
const handledUploadTaskIds = new Set<string>()

const tags = [
  'Для взрослых',
  'Приключения',
  'Анимация',
  'Комедия',
  'Чёрный юмор',
  'Демоны',
  'Для детей',
  'Мультивселенная',
  'Русский',
  'Научная фантастика',
  'Фантастика',
  'Короткометражка'
]

watch([minAge, maxAge, likedOnly, selectedTags], () => load(), { deep: true })
watch(
  () => uploadQueue.tasks.map((task) => `${task.id}:${task.status}:${task.completedAt || ''}`).join('|'),
  () => {
    const completed = uploadQueue.tasks.filter(
      (task) => task.status === 'success' && task.completedAt && !handledUploadTaskIds.has(task.id)
    )
    const shouldReload = completed.some((task) => props.definition.updateEndpoint && endpointMatches(props.definition.updateEndpoint, task.endpoint))
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
      min_age: minAge.value,
      max_age: maxAge.value,
      liked: likedOnly.value || undefined,
      tags: selectedTags.value.join(',') || undefined
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

function toggleTag(tag: string) {
  selectedTags.value = selectedTags.value.includes(tag)
    ? selectedTags.value.filter((item) => item !== tag)
    : [...selectedTags.value, tag]
}

function rowKey(row: Record<string, unknown>) {
  return String(getItemId(row, props.definition.idKey) || JSON.stringify(row))
}

function rowRoute(row: Record<string, unknown>) {
  const id = getItemId(row, props.definition.idKey)
  return props.definition.detailRoute && id !== undefined ? `${props.definition.detailRoute}/${id}` : ''
}

function titleOf(row: Record<string, unknown>) {
  return pickLocalized(getObjectValue(row, 'title')) || String(getObjectValue(row, 'name') || 'Без названия')
}

function subtitleOf(row: Record<string, unknown>) {
  return String(getObjectValue(row, 'slug') || getObjectValue(row, 'alias') || getItemId(row, props.definition.idKey) || '')
}

function posterOf(row: Record<string, unknown>) {
  const value =
    getObjectValue(row, 'poster') ||
    getObjectValue(row, 'posterUrl') ||
    getObjectValue(row, 'poster_url') ||
    getObjectValue(row, 'image') ||
    getObjectValue(row, 'thumbnail')
  return typeof value === 'string' ? value : ''
}

function ageOf(row: Record<string, unknown>) {
  const value = getObjectValue(row, 'age') || getObjectValue(row, 'age_rating') || getObjectValue(row, 'ageRating')
  return value === undefined || value === null || value === '' ? '—' : `${value}+`
}

function tagsOf(row: Record<string, unknown>) {
  const value = getObjectValue(row, 'tags') || getObjectValue(row, 'categories') || getObjectValue(row, 'genres')
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'object' ? pickLocalized(getObjectValue(item, 'title') || getObjectValue(item, 'name')) : String(item)))
    .filter(Boolean)
}

function statusOf(row: Record<string, unknown>) {
  return String(getObjectValue(row, 'transcode_status') || getObjectValue(row, 'status') || 'uploaded')
}

function progressOf(row: Record<string, unknown>) {
  const value = Number(getObjectValue(row, 'progress') || getObjectValue(row, 'transcode_progress') || 0)
  return Number.isFinite(value) ? value : 0
}

function sourceOf(row: Record<string, unknown>) {
  return String(getObjectValue(row, 'source') || '—')
}

function isPublished(row: Record<string, unknown>) {
  const value = getObjectValue(row, 'published') ?? getObjectValue(row, 'is_published') ?? getObjectValue(row, 'active')
  return value === undefined ? 'Да' : value ? 'Да' : 'Нет'
}

function ratingOf(row: Record<string, unknown>) {
  return String(getObjectValue(row, 'rating') || getObjectValue(row, 'score') || '—')
}

function triggerFile(row: Record<string, unknown>) {
  fileInputs.value[rowKey(row)]?.click()
}

function uploadFile(row: Record<string, unknown>, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  const id = getItemId(row, props.definition.idKey)
  if (!file || id === undefined || !props.definition.updateEndpoint) return

  const body = new FormData()
  body.append('video', file)
  uploadQueue.enqueue({
    endpoint: resolveEndpoint(props.definition.updateEndpoint, { id, ...row }),
    method: props.definition.updateMethod || 'PATCH',
    body,
    label: `Видео: ${file.name}`,
    resultRouteBase: props.definition.detailRoute
  })
}

function endpointMatches(template: string, endpoint: string) {
  if (template === endpoint) return true
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+')
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
  <section class="catalog-page">
    <div class="catalog-header">
      <div>
        <h1>Контент</h1>
        <p>Создайте запись, затем загрузите видео.</p>
      </div>
      <NuxtLink v-if="definition.createRoute" class="button catalog-new" :to="definition.createRoute">
        <AppIcon name="i-lucide-plus" />
        Новый
      </NuxtLink>
    </div>

    <div class="catalog-filter">
      <strong>Фильтр</strong>
      <div class="catalog-filter-row">
        <label class="compact-field">
          <span>Мин. возраст</span>
          <input v-model.number="minAge" class="input" type="number" min="0">
        </label>
        <label class="compact-field">
          <span>Макс. возраст</span>
          <input v-model.number="maxAge" class="input" type="number" min="0">
        </label>
        <label class="switch-row compact-switch">
          <input v-model="likedOnly" type="checkbox">
          <span>Только понравившиеся</span>
        </label>
      </div>
      <div class="field">
        <span class="content-field-label">По тегам</span>
        <div class="tag-list">
          <button
            v-for="tag in tags"
            :key="tag"
            class="tag-chip"
            :class="{ active: selectedTags.includes(tag) }"
            type="button"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </div>
    </div>

    <ApiErrorAlert :error="error" />

    <div class="catalog-table-wrap">
      <table class="catalog-table">
        <thead>
          <tr>
            <th></th>
            <th>Название</th>
            <th>Возраст</th>
            <th>Теги</th>
            <th>Рейтинг</th>
            <th>Статус</th>
            <th>Опубликовано</th>
            <th>Источник</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="9" class="catalog-state">Загрузка данных...</td>
          </tr>
          <tr v-else-if="!items.length">
            <td colspan="9" class="catalog-state">Нет данных</td>
          </tr>
          <tr v-for="row in items" v-else :key="rowKey(row)">
            <td class="poster-cell">
              <img v-if="posterOf(row)" :src="posterOf(row)" alt="">
              <div v-else class="poster-fallback"><AppIcon name="i-lucide-image" /></div>
            </td>
            <td>
              <strong class="catalog-title">{{ titleOf(row) }}</strong>
              <span class="catalog-subtitle">{{ subtitleOf(row) }}</span>
            </td>
            <td><span class="age-pill">{{ ageOf(row) }}</span></td>
            <td>
              <div class="table-tags">
                <span v-for="tag in tagsOf(row)" :key="tag" class="table-tag">{{ tag }}</span>
                <span v-if="!tagsOf(row).length">—</span>
              </div>
            </td>
            <td>{{ ratingOf(row) }}</td>
            <td>
              <div class="status-progress">
                <span class="table-tag">{{ statusOf(row) }}</span>
                <span>{{ progressOf(row) }}%</span>
              </div>
              <div class="thin-progress"><span :style="{ width: `${progressOf(row)}%` }" /></div>
            </td>
            <td>{{ isPublished(row) }}</td>
            <td>{{ sourceOf(row) }}</td>
            <td>
              <div class="catalog-actions">
                <NuxtLink class="button secondary small-action" :class="{ disabled: !rowRoute(row) }" :to="rowRoute(row) || '#'" title="Просмотр">
                  <AppIcon name="i-lucide-play" />
                  Просмотр
                </NuxtLink>
                <input
                  :ref="(el) => { fileInputs[rowKey(row)] = el as HTMLInputElement | null }"
                  hidden
                  type="file"
                  accept="video/*"
                  @change="uploadFile(row, $event)"
                >
                <button class="button secondary small-action" type="button" @click="triggerFile(row)">
                  <AppIcon name="i-lucide-upload-cloud" />
                  Загрузить файл
                </button>
                <NuxtLink class="icon-link" :to="rowRoute(row) || '#'" title="Редактировать">
                  <AppIcon name="i-lucide-pencil" />
                </NuxtLink>
                <button class="icon-link danger-link" type="button" title="Удалить" @click="deleteTarget = row">
                  <AppIcon name="i-lucide-trash-2" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="catalog-total">Всего: {{ total }}</div>

    <ConfirmDeleteModal
      :model-value="Boolean(deleteTarget)"
      :loading="deleting"
      @update:model-value="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </section>
</template>
