<script setup lang="ts">
import type { ApiErrorInfo, ResourceDefinition } from '~/types/api'

const props = defineProps<{
  definition: ResourceDefinition
}>()

const api = useApi()
const config = useRuntimeConfig()
const uploadQueue = useUploadQueueStore()

const items = ref<Record<string, unknown>[]>([]);

const total = ref(0)
const page = ref(1)
const limit = ref(5)
const pagination = ref<Record<string, unknown> | null>(null)
const loading = ref(false)
const deleting = ref(false)
const error = ref<ApiErrorInfo | null>(null)
const deleteTarget = ref<Record<string, unknown> | null>(null)
const searchQuery = ref('')
const minAge = ref(0)
const maxAge = ref(18)
const likedOnly = ref(false)
const selectedCategory = ref('')
const selectedTags = ref<string[]>([])
const categoryOptions = ref<Array<{ value: string; label: string; slug: string }>>([])
const categoriesLoading = ref(false)
const categoriesLoadError = ref('')
const tagOptions = ref<Array<{ id: string; label: string; slug: string }>>([])
const tagsLoading = ref(false)
const tagsLoadError = ref('')
const fileInputs = ref<Record<string, HTMLInputElement | null>>({})
const handledUploadTaskIds = new Set<string>()
const visibleTagsLimit = 3
const tagPreviewLimit = 10
const skeletonRows = 8
const tagFilterModalOpen = ref(false)
const imagePreviewOpen = ref(false)
const imagePreviewSrc = ref('')
const imagePreviewTitle = ref('')
const contentPreviewOpen = ref(false)
const contentPreviewItem = ref<Record<string, unknown> | null>(null)

function openImagePreview(item: { poster: string; title: string }) {
  imagePreviewSrc.value = item.poster
  imagePreviewTitle.value = item.title
  imagePreviewOpen.value = true
}

function openContentPreview(item: Record<string, unknown>) {
  contentPreviewItem.value = item
  contentPreviewOpen.value = true
}

const isMovieCatalog = computed(() => props.definition.key === 'movies')
const totalPages = computed(() => {
  const value = Number(getResourceValue(pagination.value, 'totalPages') ?? getResourceValue(pagination.value, 'total_pages'))
  if (Number.isFinite(value) && value > 0) return Math.floor(value)
  return Math.max(1, Math.ceil(total.value / limit.value))
})
const hasNextPage = computed(() => {
  const value = getResourceValue(pagination.value, 'hasNextPage') ?? getResourceValue(pagination.value, 'has_next_page')
  return typeof value === 'boolean' ? value : page.value < totalPages.value
})
const hasPrevPage = computed(() => {
  const value = getResourceValue(pagination.value, 'hasPrevPage') ?? getResourceValue(pagination.value, 'has_prev_page')
  return typeof value === 'boolean' ? value : page.value > 1
})

// Tag filter preview: show the first N tags (plus any already-selected ones so
// active filters stay visible); the rest live behind the "show all" modal.
const previewFilterTags = computed(() => {
  const selectedSet = new Set(selectedTags.value)
  const selectedOptions = tagOptions.value.filter((tag) => selectedSet.has(tag.id))
  const restOptions = tagOptions.value.filter((tag) => !selectedSet.has(tag.id))
  const limit = Math.max(tagPreviewLimit, selectedOptions.length)
  return [...selectedOptions, ...restOptions].slice(0, limit)
})
const hasMoreFilterTags = computed(() => tagOptions.value.length > previewFilterTags.value.length)

// Precompute per-row view models once per data change so the table template does
// not re-invoke posterOf/tagsOf/status* for every row on every reactive render.
const displayRows = computed(() => items.value.map((row) => {
  const allTags = tagsOf(row)
  return {
    key: rowKey(row),
    row,
    poster: posterOf(row),
    posterThumb: posterThumbOf(row),
    title: titleOf(row),
    age: ageOf(row),
    visibleTags: allTags.slice(0, visibleTagsLimit),
    hiddenTags: allTags.slice(visibleTagsLimit),
    hasTags: allTags.length > 0,
    rating: ratingOf(row),
    status: contentStatusOf(row),
    statusTone: statusToneOf(row),
    statusIcon: statusIconOf(row),
    statusSpin: statusToneOf(row) === 'warning',
    progressVisible: statusProgressVisible(row),
    progressPercent: statusProgressPercent(row),
    detailRoute: rowRoute(row),
    commentsPath: commentsRoute(row),
    statsRoute: statsRoute(row),
    id: String(getItemId(row, props.definition.idKey) ?? ''),
    description: descriptionOf(row),
    allTags
  }
}))

// Debounce filter changes so typing in search / age fields fires at most one
// request per pause instead of one per keystroke.
let reloadTimer: ReturnType<typeof setTimeout> | null = null
function scheduleReload() {
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    reloadTimer = null
    if (page.value === 1) void load()
    else page.value = 1
  }, 350)
}
watch([searchQuery, minAge, maxAge, likedOnly, selectedCategory, selectedTags], scheduleReload, { deep: true })
watch(page, () => load())
onBeforeUnmount(() => {
  if (reloadTimer) clearTimeout(reloadTimer)
})

function onLimitChange(next: number) {
  if (next === limit.value) return
  limit.value = next
  if (page.value === 1) void load()
  else page.value = 1
}
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
  void loadCategoryOptions()
  void loadTagOptions()
  void load()
})

async function load() {
  if (!props.definition.listEndpoint) return

  loading.value = true
  error.value = null

  try {
    const response = await api.get(props.definition.listEndpoint, buildListQuery())
    const normalized = normalizeList(response, props.definition.key)
    const scopedItems = await filterCatalogItems(normalized.items)
    pagination.value = extractPagination(response)
    items.value = scopedItems
    total.value = scopedItems.length === normalized.items.length
      ? normalized.total ?? normalized.items.length
      : scopedItems.length
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
    items.value = []
    total.value = 0
    pagination.value = null
  } finally {
    loading.value = false
  }

}

function buildListQuery() {
  const tagsQuery = selectedTags.value.join(',') || undefined
  const query: Record<string, unknown> = {
    page: page.value,
    limit: limit.value
  }

  if (isMovieCatalog.value) {
    query.q = searchQuery.value.trim() || undefined
    query.min_age = minAge.value
    query.max_age = maxAge.value
    query.liked = likedOnly.value || undefined
    query.category_id = selectedCategory.value || undefined
    query.tag_ids = tagsQuery
  }

  return query
}

function extractPagination(payload: unknown): Record<string, unknown> | null {
  const unwrapped = unwrapPayload<Record<string, unknown>>(payload, props.definition.key)
  const value = getResourceValue(unwrapped, 'pagination') ?? getResourceValue(payload, 'pagination')
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function toggleTag(tag: string) {
  selectedTags.value = selectedTags.value.includes(tag)
    ? selectedTags.value.filter((item) => item !== tag)
    : [...selectedTags.value, tag]
}

function resetFilters() {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedTags.value = []
  minAge.value = 0
  maxAge.value = 18
  likedOnly.value = false
}

async function loadCategoryOptions() {
  if (!isMovieCatalog.value) return

  categoriesLoading.value = true
  categoriesLoadError.value = ''

  try {
    const response = await api.get('/v1/content/categories', { limit: 100 })
    const seen = new Set<string>()

    categoryOptions.value = normalizeList(response, 'categories').items
      .map(toCategoryOption)
      .filter((option): option is { value: string; label: string; slug: string } => {
        if (!option || seen.has(option.value)) return false
        seen.add(option.value)
        return true
      })

    if (selectedCategory.value && !categoryOptions.value.some((category) => category.value === selectedCategory.value)) {
      selectedCategory.value = ''
    }
  } catch {
    categoriesLoadError.value = 'Не удалось загрузить категории'
    categoryOptions.value = []
    selectedCategory.value = ''
  } finally {
    categoriesLoading.value = false
  }
}

async function loadTagOptions() {
  if (!isMovieCatalog.value) return

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

function toCategoryOption(item: Record<string, unknown>): { value: string; label: string; slug: string } | null {
  const id = getItemId(item)
  const slug = String(getResourceValue(item, 'slug') || '').trim()
  const title = pickLocalized(getResourceValue(item, 'title') ?? getResourceValue(item, 'name') ?? getResourceValue(item, 'label'))
  const value = id === undefined ? slug || title : String(id)

  if (!value) return null

  const label = title || slug || value

  return {
    value,
    label: slug && slug !== label ? `${label} (${slug})` : label,
    slug
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

function commentsRoute(row: Record<string, unknown>) {
  const id = getItemId(row, props.definition.idKey)
  return id !== undefined ? `/content/comments?contentId=${encodeURIComponent(String(id))}` : ''
}

function statsRoute(row: Record<string, unknown>) {
  const id = getItemId(row, props.definition.idKey)
  return id !== undefined ? `/content/analytics/${encodeURIComponent(String(id))}` : ''
}

function descriptionOf(row: Record<string, unknown>) {
  return pickLocalized(getObjectValue(row, 'description') ?? getObjectValue(row, 'synopsis')) || ''
}

function titleOf(row: Record<string, unknown>) {
  return pickLocalized(getObjectValue(row, 'title')) || String(getObjectValue(row, 'name') || 'Без названия')
}

function posterOf(row: Record<string, unknown>) {
  if (props.definition.key === 'series' && getResourceValue(row, 'poster_path')) {
    const id = getItemId(row, props.definition.idKey)
    if (id !== undefined) return mediaUrl(`/api/v1/series/${encodeURIComponent(String(id))}/poster`)
  }

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

// Small cached thumbnail served by the backend at /media-thumb; only our own
// /media assets can be resized, external/API poster URLs pass through unchanged.
function posterThumbOf(row: Record<string, unknown>): string {
  const full = posterOf(row)
  if (!full) return ''

  const marker = '/media/'
  const index = full.indexOf(marker)
  if (index === -1) return full

  return `${full.slice(0, index)}/media-thumb/${full.slice(index + marker.length)}?w=256`
}

function mediaUrl(value: unknown): string {
  const source = normalizeMediaPath(value)
  if (!source) return ''
  if (/^(https?:|data:|blob:)/i.test(source)) return source

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

// Map the transcode status to an icon (the text labels overflow the narrow column).
// The full status text stays available via the cell's title tooltip.
function statusIconOf(row: Record<string, unknown>) {
  const tone = statusToneOf(row)
  if (tone === 'success') return 'i-lucide-circle-check-big'
  if (tone === 'danger') return 'i-lucide-circle-alert'
  if (tone === 'warning') return 'i-lucide-loader'
  return 'i-lucide-circle-dashed'
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

    <div v-if="isMovieCatalog" class="catalog-filter">
      <strong>Фильтр</strong>
      <div class="catalog-filter-row">
        <label v-if="isMovieCatalog" class="compact-field catalog-search-field">
          <span>Поиск</span>
          <input v-model="searchQuery" class="input" type="search" placeholder="Название или текст">
        </label>
        <label v-if="isMovieCatalog" class="compact-field catalog-category-field">
          <span>Категория</span>
          <select v-model="selectedCategory" class="select" :disabled="categoriesLoading">
            <option value="">Все категории</option>
            <option v-for="category in categoryOptions" :key="category.value" :value="category.value">
              {{ category.label }}
            </option>
          </select>
        </label>
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
        <button v-if="isMovieCatalog" class="button secondary small-action catalog-filter-reset" type="button"
          @click="resetFilters">
          <AppIcon name="i-lucide-x" />
          Сбросить
        </button>
      </div>
      <small v-if="categoriesLoadError" class="field-hint">{{ categoriesLoadError }}</small>
      <div v-if="isMovieCatalog" class="field">
        <span class="content-field-label">По тегам</span>
        <div v-if="tagsLoading" class="field-hint">Загрузка тегов...</div>
        <div v-else-if="tagOptions.length" class="tag-list">
          <button v-for="tag in previewFilterTags" :key="tag.id" class="tag-chip"
            :class="{ active: selectedTags.includes(tag.id) }" type="button" @click="toggleTag(tag.id)">
            {{ tag.label }}
          </button>
          <button v-if="hasMoreFilterTags" class="tag-chip tag-chip-more" type="button"
            @click="tagFilterModalOpen = true">
            Показать все ({{ tagOptions.length }})…
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
          <template v-if="loading">
            <tr v-for="n in skeletonRows" :key="`sk-${n}`" class="skeleton-row">
              <td class="poster-cell"><span class="sk sk-poster" /></td>
              <td><span class="sk sk-line" /></td>
              <td><span class="sk sk-pill" /></td>
              <td><span class="sk sk-btn" /></td>
              <td><span class="sk sk-line sk-short" /></td>
              <td><span class="sk sk-icon" /></td>
              <td><span class="sk sk-actions" /></td>
            </tr>
          </template>
          <tr v-else-if="!displayRows.length">
            <td colspan="7" class="catalog-state">Нет данных</td>
          </tr>
          <tr v-for="item in displayRows" v-else :key="item.key">
            <td class="poster-cell">
              <button v-if="item.poster" class="poster-thumb" type="button" title="Открыть постер"
                @click="openImagePreview(item)">
                <DeferredImage :src="item.posterThumb || item.poster" :fallback-src="item.poster" :alt="item.title" />
              </button>
              <div v-else class="poster-thumb poster-fallback">
                <AppIcon name="i-lucide-image" />
              </div>
            </td>
            <td>
              <strong class="catalog-title">{{ item.title }}</strong>
            </td>
            <td><span class="age-pill">{{ item.age }}</span></td>
            <td>
              <button class="button secondary small-action" type="button" title="Обзор контента"
                @click="openContentPreview(item)">
                <AppIcon name="i-lucide-eye" />
                Показать
              </button>
            </td>
            <td>{{ item.rating }}</td>
            <td>
              <span class="status-icon" :class="item.statusTone" :title="item.status">
                <AppIcon :name="item.statusIcon" :spin="item.statusSpin" />
              </span>
              <div v-if="item.progressVisible" class="thin-progress" :title="`${item.progressPercent}%`">
                <span :style="{ width: `${item.progressPercent}%` }" />
              </div>
            </td>
            <td>
              <div class="catalog-actions">
                <NuxtLink class="icon-link" :class="{ disabled: !item.detailRoute }" :to="item.detailRoute || '#'"
                  title="Редактировать">
                  <AppIcon name="i-lucide-pencil" />
                </NuxtLink>
                <NuxtLink v-if="item.commentsPath" class="icon-link" :to="item.commentsPath" title="Комментарии">
                  <AppIcon name="i-lucide-message-square-text" />
                </NuxtLink>
                <NuxtLink class="icon-link" :class="{ disabled: !item.statsRoute }" :to="item.statsRoute || '#'"
                  title="Статистика">
                  <AppIcon name="i-lucide-bar-chart-3" />
                </NuxtLink>
                <button class="icon-link danger-link" type="button" title="Удалить" @click="deleteTarget = item.row">
                  <AppIcon name="i-lucide-trash-2" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <DataTablePagination
      :page="page"
      :total="total"
      :limit="limit"
      :has-next="hasNextPage"
      :page-size-options="[5, 10, 20, 50, 100]"
      @update:page="page = $event"
      @update:limit="onLimitChange"
    />

    <ConfirmDeleteModal :model-value="Boolean(deleteTarget)" :loading="deleting"
      @update:model-value="deleteTarget = null" @confirm="confirmDelete" />

    <TagPickerModal v-model:open="tagFilterModalOpen" :tags="tagOptions" :selected="selectedTags"
      @toggle="toggleTag" @clear="selectedTags = []" />

    <ContentPreviewModal v-model:open="contentPreviewOpen" :item="contentPreviewItem" />

    <Teleport to="body">
      <div v-if="imagePreviewOpen" class="poster-lightbox" @click.self="imagePreviewOpen = false">
        <div class="poster-lightbox-inner">
          <button class="icon-link poster-lightbox-close" type="button" title="Закрыть"
            @click="imagePreviewOpen = false">
            <AppIcon name="i-lucide-x" />
          </button>
          <img :src="imagePreviewSrc" :alt="imagePreviewTitle">
          <p v-if="imagePreviewTitle" class="poster-lightbox-caption">{{ imagePreviewTitle }}</p>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.tag-chip-more {
  border-style: dashed;
  opacity: 0.85;
}

.poster-thumb {
  aspect-ratio: 16 / 9;
  width: 128px;
  max-width: 100%;
  padding: 0;
  border: 1px solid var(--border, #2a2d36);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: var(--faint, #1a1c22);
  display: block;
}

.poster-thumb.poster-fallback {
  display: grid;
  place-items: center;
  color: var(--muted);
  cursor: default;
}

.poster-thumb :deep(.lazy-image) {
  width: 100%;
  height: 100%;
}

.poster-lightbox {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 82%);
  padding: 24px;
}

.poster-lightbox-inner {
  position: relative;
  max-width: min(960px, 100%);
}

.poster-lightbox-inner img {
  max-width: 100%;
  max-height: 82vh;
  border-radius: 12px;
  display: block;
}

.poster-lightbox-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgb(0 0 0 / 50%);
}

.poster-lightbox-caption {
  color: #fff;
  text-align: center;
  margin-top: 10px;
}

/* Status as a compact icon chip (text labels overflow the narrow column). */
.status-icon {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: var(--muted);
  background: color-mix(in srgb, currentColor 12%, transparent);
}

.status-icon.success {
  color: var(--primary, #10b981);
}

.status-icon.warning {
  color: #d97706;
}

.status-icon.danger {
  color: #dc2626;
}

.status-icon :deep(svg),
.status-icon :deep(.iconify) {
  width: 18px;
  height: 18px;
}

/* Pinterest-style skeleton frame while the first data request is in flight. */
.sk {
  display: block;
  border-radius: 6px;
  background: var(--faint, #1a1c22);
  animation: sk-pulse 1.2s ease-in-out infinite;
}

.sk-poster {
  width: 128px;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
}

.sk-line {
  width: 70%;
  height: 14px;
}

.sk-line.sk-short {
  width: 42%;
}

.sk-pill {
  width: 44px;
  height: 20px;
  border-radius: 999px;
}

.sk-btn {
  width: 96px;
  height: 30px;
  border-radius: 8px;
}

.sk-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
}

.sk-actions {
  width: 128px;
  height: 28px;
  border-radius: 8px;
}

@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Snappy row hover with a solid colour (no transition/blur); posters sit on
   their own compositing layer so highlighting a row never re-rasterizes them. */
.catalog-table tbody tr:hover td {
  background: var(--surface-hover);
}

.poster-thumb {
  transform: translateZ(0);
}
</style>
