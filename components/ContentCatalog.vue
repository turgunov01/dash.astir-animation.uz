<script setup lang="ts">
import type { ApiErrorInfo, ResourceDefinition } from '~/types/api'

const props = defineProps<{
  definition: ResourceDefinition
}>()

const api = useApi()
const config = useRuntimeConfig()
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
const tagOptions = ref<Array<{ id: string; label: string; slug: string }>>([])
const tagsLoading = ref(false)
const tagsLoadError = ref('')
const fileInputs = ref<Record<string, HTMLInputElement | null>>({})
const handledUploadTaskIds = new Set<string>()
const visibleTagsLimit = 3

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
onMounted(() => {
  void loadTagOptions()
  void load()
})

async function load() {
  if (!props.definition.listEndpoint) return

  loading.value = true
  error.value = null

  try {
    const response = await api.get(props.definition.listEndpoint, {
      min_age: minAge.value,
      max_age: maxAge.value,
      liked: likedOnly.value || undefined,
      tag_ids: selectedTags.value.join(',') || undefined
    })
    const normalized = normalizeList(response, props.definition.key)
    const scopedItems = filterCatalogItems(normalized.items)
    items.value = scopedItems
    total.value = scopedItems.length === normalized.items.length
      ? normalized.total ?? normalized.items.length
      : scopedItems.length
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

async function loadTagOptions() {
  tagsLoading.value = true
  tagsLoadError.value = ''

  try {
    const response = await api.get('/v1/content/tags', { limit: 100 })
    const seen = new Set<string>()

    tagOptions.value = normalizeList(response, 'tags').items
      .map(toTagOption)
      .filter((option): option is { id: string; label: string; slug: string } => {
        if (!option || seen.has(option.id)) return false
        seen.add(option.id)
        return true
      })

    selectedTags.value = selectedTags.value.filter((tagId) => tagOptions.value.some((tag) => tag.id === tagId))
  } catch {
    tagsLoadError.value = 'Не удалось загрузить теги'
    tagOptions.value = []
    selectedTags.value = []
  } finally {
    tagsLoading.value = false
  }
}

function toTagOption(item: Record<string, unknown>): { id: string; label: string; slug: string } | null {
  const id = getItemId(item)
  if (id === undefined) return null

  const name = String(getResourceValue(item, 'name') || '').trim()
  const slug = String(getResourceValue(item, 'slug') || '').trim()

  return {
    id: String(id),
    label: name || slug || String(id),
    slug
  }
}

function filterCatalogItems(rows: Record<string, unknown>[]) {
  if (props.definition.key === 'series') {
    return rows.filter((row) => !isMovieItem(row))
  }

  if (props.definition.key === 'movies') {
    return rows.filter((row) => !isSeriesItem(row))
  }

  return rows
}

function isMovieItem(row: Record<string, unknown>) {
  const contentType = normalizedContentType(row)
  if (['movie', 'movies', 'film', 'films'].includes(contentType)) return true
  if (['series', 'serial', 'tv_series', 'seasons', 'episodes'].includes(contentType)) return false

  return Boolean(
    getResourceValue(row, 'movie_id') ||
    getResourceValue(row, 'source') ||
    getResourceValue(row, 'video_url') ||
    getResourceValue(row, 'videoUrl') ||
    getResourceValue(row, 'transcode_status') ||
    getResourceValue(row, 'playback') ||
    getResourceValue(row, 'media.has_source')
  )
}

function isSeriesItem(row: Record<string, unknown>) {
  const contentType = normalizedContentType(row)
  if (['series', 'serial', 'tv_series', 'seasons', 'episodes'].includes(contentType)) return true
  if (['movie', 'movies', 'film', 'films'].includes(contentType)) return false

  return Boolean(
    getResourceValue(row, 'series_id') ||
    getResourceValue(row, 'episodesCount') ||
    getResourceValue(row, 'episodes_count') ||
    getResourceValue(row, 'seasonsCount') ||
    getResourceValue(row, 'seasons_count')
  )
}

function normalizedContentType(row: Record<string, unknown>) {
  return String(
    getResourceValue(row, 'content_type') ||
    getResourceValue(row, 'contentType') ||
    getResourceValue(row, 'type') ||
    getResourceValue(row, 'kind') ||
    ''
  ).trim().toLowerCase()
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

function posterOf(row: Record<string, unknown>) {
  const value =
    getResourceValue(row, 'poster_url') ??
    getResourceValue(row, 'posterUrl') ??
    getResourceValue(row, 'poster.url') ??
    getResourceValue(row, 'poster') ??
    getResourceValue(row, 'image_url') ??
    getResourceValue(row, 'image') ??
    getResourceValue(row, 'thumbnail_url') ??
    getResourceValue(row, 'thumbnail')
  const path = pickMediaPath(value)
  return path ? mediaUrl(path) : ''
}

function mediaUrl(value: unknown): string {
  const source = String(value || '')
  if (!source) return ''
  if (/^https?:\/\//i.test(source)) return source

  const baseUrl = String(config.public.apiBaseUrl || '').replace(/\/$/, '')
  return `${baseUrl}/${source.replace(/^\//, '')}`
}

function ageOf(row: Record<string, unknown>) {
  const value = getObjectValue(row, 'age') ?? getObjectValue(row, 'age_rating') ?? getObjectValue(row, 'ageRating')
  const age = String(value ?? '').trim()
  if (!age) return '—'
  return age.endsWith('+') ? age : `${age}+`
}

function tagsOf(row: Record<string, unknown>) {
  const value = getResourceValue(row, 'tags') || getResourceValue(row, 'categories') || getResourceValue(row, 'genres')
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (item && typeof item === 'object') {
        return (
          pickLocalized(getObjectValue(item, 'title')) ||
          pickLocalized(getObjectValue(item, 'name')) ||
          pickLocalized(getObjectValue(item, 'label'))
        )
      }

      return String(item)
    })
    .filter(Boolean)
}

function visibleTagsOf(row: Record<string, unknown>) {
  return tagsOf(row).slice(0, visibleTagsLimit)
}

function hiddenTagsOf(row: Record<string, unknown>) {
  return tagsOf(row).slice(visibleTagsLimit)
}

function contentStatusOf(row: Record<string, unknown>) {
  return transcodeStatusLabel(row)
}

function statusToneOf(row: Record<string, unknown>) {
  return transcodeStatusTone(row)
}

function statusProgressVisible(row: Record<string, unknown>) {
  return transcodeProgressVisible(row)
}

function statusProgressPercent(row: Record<string, unknown>) {
  return transcodeProgressPercent(row) ?? 0
}

function ratingOf(row: Record<string, unknown>) {
  const value = getObjectValue(row, 'rating') ?? getObjectValue(row, 'score')
  const rating = String(value ?? '').trim()
  if (!rating) return '—'
  return rating.includes('★') || rating.includes('*') ? rating : `${rating} ★`
}

function triggerFile(row: Record<string, unknown>) {
  fileInputs.value[rowKey(row)]?.click()
}

function canUploadFileFromCatalog() {
  return false
}

function uploadFile(row: Record<string, unknown>, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  const id = getItemId(row, props.definition.idKey)
  if (!canUploadFileFromCatalog() || !file || id === undefined || !props.definition.updateEndpoint) return

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
        <div v-if="tagsLoading" class="field-hint">Загрузка тегов...</div>
        <div v-else-if="tagOptions.length" class="tag-list">
          <button
            v-for="tag in tagOptions"
            :key="tag.id"
            class="tag-chip"
            :class="{ active: selectedTags.includes(tag.id) }"
            type="button"
            @click="toggleTag(tag.id)"
          >
            {{ tag.label }}
          </button>
        </div>
        <small v-else class="field-hint">{{ tagsLoadError || 'Теги в API пока не созданы.' }}</small>
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="catalog-state">Загрузка данных...</td>
          </tr>
          <tr v-else-if="!items.length">
            <td colspan="7" class="catalog-state">Нет данных</td>
          </tr>
          <tr v-for="row in items" v-else :key="rowKey(row)">
            <td class="poster-cell">
              <img v-if="posterOf(row)" :src="posterOf(row)" alt="">
              <div v-else class="poster-fallback"><AppIcon name="i-lucide-image" /></div>
            </td>
            <td>
              <strong class="catalog-title">{{ titleOf(row) }}</strong>
            </td>
            <td><span class="age-pill">{{ ageOf(row) }}</span></td>
            <td>
              <div class="table-tags">
                <span v-for="tag in visibleTagsOf(row)" :key="tag" class="table-tag">{{ tag }}</span>
                <span
                  v-if="hiddenTagsOf(row).length"
                  class="table-tag table-tag-more"
                  :title="hiddenTagsOf(row).join(', ')"
                >
                  ...
                </span>
                <span v-if="!tagsOf(row).length">—</span>
              </div>
            </td>
            <td>{{ ratingOf(row) }}</td>
            <td>
              <span class="table-tag status-tag" :class="statusToneOf(row)">{{ contentStatusOf(row) }}</span>
              <div v-if="statusProgressVisible(row)" class="thin-progress" :title="`${statusProgressPercent(row)}%`">
                <span :style="{ width: `${statusProgressPercent(row)}%` }" />
              </div>
            </td>
            <td>
              <div class="catalog-actions">
                <NuxtLink class="button secondary small-action" :class="{ disabled: !rowRoute(row) }" :to="rowRoute(row) || '#'" title="Просмотр">
                  <AppIcon name="i-lucide-play" />
                  Просмотр
                </NuxtLink>
                <input
                  v-if="canUploadFileFromCatalog()"
                  :ref="(el) => { fileInputs[rowKey(row)] = el as HTMLInputElement | null }"
                  hidden
                  type="file"
                  accept="video/*"
                  @change="uploadFile(row, $event)"
                >
                <button v-if="canUploadFileFromCatalog()" class="button secondary small-action" type="button" @click="triggerFile(row)">
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
