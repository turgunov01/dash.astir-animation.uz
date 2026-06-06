<script setup lang="ts">
import type { ApiErrorInfo, LocalizedText, ResourceDefinition } from '~/types/api'

interface ContentSelectOption {
  label: string
  value: string
}

const props = withDefaults(
  defineProps<{
    definition: ResourceDefinition
    contentType?: 'movie' | 'series'
    backTo: string
  }>(),
  {
    contentType: 'movie'
  }
)

const api = useApi()
const router = useRouter()
const uploadQueue = useUploadQueueStore()

const title = ref<LocalizedText>({ uz: '', ru: '', en: '' })
const description = ref<LocalizedText>({ uz: '', ru: '', en: '' })
const isPremium = ref(false)
const published = ref(false)
const selectedCategoryId = ref('')
const selectedSeriesId = ref('')
const releaseYear = ref<number | ''>('')
const ageRating = ref(0)
const durationSec = ref(0)
const seriesKind = ref<'seasons' | 'episodes'>('seasons')
const seriesActive = ref(true)
const selectedTagIds = ref<string[]>([])
const freeFormTags = ref<string[]>([])
const categoryOptions = ref<ContentSelectOption[]>([])
const seriesOptions = ref<ContentSelectOption[]>([])
const referenceLoading = ref(false)
const referenceLoadError = ref('')
const poster = ref<File | null>(null)
const video = ref<File | null>(null)
const posterInput = ref<HTMLInputElement | null>(null)
const videoInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const error = ref<ApiErrorInfo | null>(null)

const locales = ['uz', 'ru', 'en'] as const
const posterPreview = computed(() => (poster.value && process.client ? URL.createObjectURL(poster.value) : ''))
const pageTitle = computed(() => (props.contentType === 'series' ? 'Новый сериал' : 'Новый фильм'))

onMounted(() => {
  if (props.contentType === 'movie') void loadMovieReferenceOptions()
})

async function submit() {
  error.value = null

  if (!Object.values(title.value).some((entry) => String(entry || '').trim())) {
    error.value = { message: 'Заполните название хотя бы на одном языке.' }
    return
  }

  loading.value = true

  try {
    if (props.contentType === 'series') {
      const result = await api.post(props.definition.createEndpoint || '', buildSeriesBody())
      const id = getCreatedId(result)

      if (id !== undefined && poster.value) {
        const posterBody = new FormData()
        posterBody.append('file', poster.value)
        uploadQueue.enqueue({
          endpoint: resolveEndpoint('/api/v1/series/{id}/poster', { id }),
          method: 'POST',
          body: posterBody,
          label: `Постер: ${poster.value.name}`,
          resultRouteBase: props.definition.detailRoute
        })
      }

      await router.push(id && props.definition.detailRoute ? `${props.definition.detailRoute}/${id}` : props.backTo)
      return
    }

    if (video.value || poster.value) {
      const body = new FormData()
      body.append('metadata', JSON.stringify(buildMovieMetadata()))
      if (video.value) body.append('video', video.value)
      if (poster.value) body.append('poster', poster.value)
      uploadQueue.enqueue({
        endpoint: props.definition.createEndpoint || '',
        method: 'POST',
        body,
        label: video.value ? `Видео: ${video.value.name}` : `Постер: ${poster.value?.name || 'movie poster'}`,
        resultRouteBase: props.definition.detailRoute
      })
      await router.push(props.backTo)
      return
    }

    const result = await api.post(props.definition.createEndpoint || '', buildMovieMetadata())
    const id = getCreatedId(result)
    await router.push(id && props.definition.detailRoute ? `${props.definition.detailRoute}/${id}` : props.backTo)
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    loading.value = false
  }
}

function buildSeriesBody() {
  return {
    title: title.value,
    description: description.value,
    kind: seriesKind.value,
    active: seriesActive.value
  }
}

function buildMovieMetadata() {
  const metadata: Record<string, unknown> = {
    title: title.value,
    description: description.value,
    content_type: 'movie',
    category_id: selectedCategoryId.value || undefined,
    series_id: selectedSeriesId.value || undefined,
    year: normalizeOptionalInteger(releaseYear.value),
    age_rating: normalizeInteger(ageRating.value, 0),
    duration_sec: normalizeInteger(durationSec.value, 0),
    published: published.value,
    is_premium: isPremium.value,
    tag_ids: selectedTagIds.value,
    tags: freeFormTags.value
  }

  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined && value !== ''))
}

function getCreatedId(payload: unknown) {
  const data = unwrapPayload<Record<string, unknown>>(payload)
  return getItemId(data) || getItemId(data?.movie) || getItemId(data?.content) || getItemId(data?.series)
}

async function loadMovieReferenceOptions() {
  referenceLoading.value = true
  referenceLoadError.value = ''

  const [categoriesResult, seriesResult] = await Promise.allSettled([
    api.get('/v1/content/categories', { limit: 100 }),
    api.get('/api/v1/series', { limit: 100 })
  ])

  if (categoriesResult.status === 'fulfilled') {
    categoryOptions.value = normalizeList(categoriesResult.value, 'categories').items
      .map(toSelectOption)
      .filter((option): option is ContentSelectOption => Boolean(option))
  } else {
    categoryOptions.value = []
  }

  if (seriesResult.status === 'fulfilled') {
    seriesOptions.value = normalizeList(seriesResult.value, 'series').items
      .map(toSelectOption)
      .filter((option): option is ContentSelectOption => Boolean(option))
  } else {
    seriesOptions.value = []
  }

  if (categoriesResult.status === 'rejected' || seriesResult.status === 'rejected') {
    referenceLoadError.value = 'Не удалось загрузить категории или сериалы.'
  }

  referenceLoading.value = false
}

function toSelectOption(item: Record<string, unknown>): ContentSelectOption | null {
  const id = getItemId(item)
  if (id === undefined) return null

  return {
    value: String(id),
    label: pickLocalized(getResourceValue(item, 'title')) ||
      String(getResourceValue(item, 'name') || getResourceValue(item, 'slug') || id)
  }
}

function normalizeInteger(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback
}

function normalizeOptionalInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return normalizeInteger(value, 0)
}
</script>

<template>
  <section class="modal-page">
    <form class="content-modal" @submit.prevent="submit">
      <div class="content-modal-header">
        <h1>{{ pageTitle }}</h1>
        <NuxtLink class="modal-close" :to="backTo" aria-label="Закрыть">
          <AppIcon name="i-lucide-x" />
        </NuxtLink>
      </div>

      <ApiErrorAlert :error="error" />

      <div class="content-form-layout">
        <aside class="poster-column">
          <template v-if="contentType === 'movie' || contentType === 'series'">
            <span class="content-field-label">Постер</span>
            <button class="poster-preview" type="button" @click="posterInput?.click()">
              <img v-if="posterPreview" :src="posterPreview" alt="">
              <span v-else>
                <AppIcon name="i-lucide-image" />
                Нет постера
              </span>
            </button>
            <input ref="posterInput" hidden type="file" accept="image/*" @change="poster = ($event.target as HTMLInputElement).files?.[0] || null">
            <button class="button secondary poster-upload" type="button" @click="posterInput?.click()">
              <AppIcon name="i-lucide-upload-cloud" />
              {{ poster ? poster.name : 'Загрузить постер' }}
            </button>
          </template>
          <input ref="videoInput" hidden type="file" accept="video/*" @change="video = ($event.target as HTMLInputElement).files?.[0] || null">
          <button v-if="contentType === 'movie'" class="button secondary poster-upload" type="button" @click="videoInput?.click()">
            <AppIcon name="i-lucide-file-video" />
            {{ video ? video.name : 'Загрузить видео' }}
          </button>
        </aside>

        <div class="content-fields">
          <div class="localized-block">
            <div class="content-field-head">
              <span class="content-field-label">Название <b>*</b></span>
              <small>Заполните хотя бы на одном языке.</small>
            </div>
            <label v-for="locale in locales" :key="locale" class="localized-row">
              <span>{{ locale.toUpperCase() }}</span>
              <input v-model="title[locale]" class="input" type="text">
            </label>
          </div>

          <div class="localized-block">
            <div class="content-field-head">
              <span class="content-field-label">Описание</span>
              <small>Заполните хотя бы на одном языке.</small>
            </div>
            <label v-for="locale in locales" :key="locale" class="localized-row textarea-row">
              <span>{{ locale.toUpperCase() }}</span>
              <textarea v-model="description[locale]" class="textarea" rows="3" />
            </label>
          </div>

          <template v-if="contentType === 'movie'">
            <small v-if="referenceLoading" class="field-hint">Загрузка справочников...</small>
            <small v-else-if="referenceLoadError" class="field-hint">{{ referenceLoadError }}</small>

            <div class="content-number-grid">
              <label class="field">
                <span class="content-field-label">Категория</span>
                <select v-model="selectedCategoryId" class="select">
                  <option value="">Не выбрано</option>
                  <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>
              <label class="field">
                <span class="content-field-label">Сериал</span>
                <select v-model="selectedSeriesId" class="select">
                  <option value="">Без сериала</option>
                  <option v-for="option in seriesOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>
            </div>

            <div class="content-number-grid">
              <label class="field">
                <span class="content-field-label">Год выпуска</span>
                <input v-model.number="releaseYear" class="input" type="number" min="0" placeholder="2026">
              </label>
              <label class="field">
                <span class="content-field-label">Возрастное ограничение</span>
                <input v-model.number="ageRating" class="input" type="number" min="0">
              </label>
              <label class="field">
                <span class="content-field-label">Длительность, секунд</span>
                <input v-model.number="durationSec" class="input" type="number" min="0">
              </label>
            </div>
          </template>

          <label v-if="contentType === 'movie'" class="switch-row">
            <input v-model="published" type="checkbox">
            <span>Опубликовано</span>
          </label>

          <label v-if="contentType === 'movie'" class="switch-row">
            <input v-model="isPremium" type="checkbox">
            <span>Премиум</span>
          </label>

          <div v-if="contentType === 'series'" class="content-number-grid">
            <label class="field">
              <span class="content-field-label">Тип сериала</span>
              <select v-model="seriesKind" class="select">
                <option value="seasons">Сезоны</option>
                <option value="episodes">Эпизоды</option>
              </select>
            </label>
            <label class="switch-row">
              <input v-model="seriesActive" type="checkbox">
              <span>Активен</span>
            </label>
          </div>

          <div v-if="contentType === 'movie'" class="field">
            <span class="content-field-label">Теги</span>
            <ContentTagSelector
              v-model:selected-tag-ids="selectedTagIds"
              v-model:free-form-tags="freeFormTags"
              :disabled="loading"
            />
          </div>

          <div class="content-modal-actions">
            <NuxtLink class="button secondary" :to="backTo">Отмена</NuxtLink>
            <button class="button" type="submit" :disabled="loading">
              {{ loading ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
        </div>
      </div>
    </form>
  </section>
</template>
