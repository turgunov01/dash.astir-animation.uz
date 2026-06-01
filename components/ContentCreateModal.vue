<script setup lang="ts">
import type { ApiErrorInfo, LocalizedText, ResourceDefinition } from '~/types/api'

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
const category = ref('')
const year = ref(new Date().getFullYear())
const age = ref(0)
const duration = ref(0)
const selectedSeries = ref('')
const published = ref(true)
const tags = ref<string[]>([])
const poster = ref<File | null>(null)
const video = ref<File | null>(null)
const posterInput = ref<HTMLInputElement | null>(null)
const videoInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const error = ref<ApiErrorInfo | null>(null)
const seriesOptions = ref<Array<{ label: string; value: string | number }>>([])

const locales = ['uz', 'ru', 'en'] as const
const tagOptions = [
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
const categories = [
  { label: '— выберите —', value: '' },
  { label: 'Анимация', value: 'animation' },
  { label: 'Приключения', value: 'adventure' },
  { label: 'Комедия', value: 'comedy' },
  { label: 'Фантастика', value: 'fantasy' }
]

const posterPreview = computed(() => (poster.value && process.client ? URL.createObjectURL(poster.value) : ''))

onMounted(loadSeriesOptions)

function toggleTag(tag: string) {
  tags.value = tags.value.includes(tag) ? tags.value.filter((item) => item !== tag) : [...tags.value, tag]
}

async function submit() {
  error.value = null

  if (!Object.values(title.value).some((entry) => String(entry || '').trim())) {
    error.value = { message: 'Заполните название хотя бы на одном языке.' }
    return
  }

  loading.value = true

  try {
    const body = new FormData()
    body.append('metadata', JSON.stringify(buildMetadata()))
    if (poster.value) body.append('poster', poster.value)
    if (video.value) body.append('video', video.value)

    if (video.value) {
      uploadQueue.enqueue({
        endpoint: props.definition.createEndpoint || '',
        method: 'POST',
        body,
        label: `Видео: ${video.value.name}`,
        resultRouteBase: props.definition.detailRoute
      })
      await router.push(props.backTo)
      return
    }

    const result = await api.post(props.definition.createEndpoint || '', body)
    const id = getCreatedId(result)
    await router.push(id && props.definition.detailRoute ? `${props.definition.detailRoute}/${id}` : props.backTo)
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    loading.value = false
  }
}

function buildMetadata() {
  return {
    title: title.value,
    description: description.value,
    category: category.value || undefined,
    year: Number(year.value) || undefined,
    age: Number(age.value) || 0,
    duration: Number(duration.value) || 0,
    duration_seconds: Number(duration.value) || 0,
    is_published: published.value,
    published: published.value,
    series: selectedSeries.value ? [selectedSeries.value] : [],
    tags: tags.value
  }
}

function getCreatedId(payload: unknown) {
  const data = unwrapPayload<Record<string, unknown>>(payload)
  return getItemId(data) || getItemId(data?.movie) || getItemId(data?.content) || getItemId(data?.series)
}

async function loadSeriesOptions() {
  if (props.contentType !== 'movie') return

  try {
    const response = await api.get('/api/v1/series', { limit: 100 })
    seriesOptions.value = normalizeList(response).items
      .map((item) => {
        const id = getItemId(item)
        return id === undefined ? null : { label: pickLocalized(getObjectValue(item, 'title')) || String(id), value: id }
      })
      .filter((item): item is { label: string; value: string | number } => Boolean(item))
  } catch {
    seriesOptions.value = []
  }
}
</script>

<template>
  <section class="modal-page">
    <form class="content-modal" @submit.prevent="submit">
      <div class="content-modal-header">
        <h1>Новый контент</h1>
        <NuxtLink class="modal-close" :to="backTo" aria-label="Закрыть">
          <AppIcon name="i-lucide-x" />
        </NuxtLink>
      </div>

      <ApiErrorAlert :error="error" />

      <div class="content-form-layout">
        <aside class="poster-column">
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
            Загрузить постер
          </button>
          <input ref="videoInput" hidden type="file" accept="video/*" @change="video = ($event.target as HTMLInputElement).files?.[0] || null">
          <button class="button secondary poster-upload" type="button" @click="videoInput?.click()">
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

          <label class="field">
            <span class="content-field-label">Категория</span>
            <select v-model="category" class="select">
              <option v-for="option in categories" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>

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

          <div class="content-number-grid">
            <label class="field">
              <span class="content-field-label">Год</span>
              <input v-model.number="year" class="input" type="number">
            </label>
            <label class="field">
              <span class="content-field-label">Возраст</span>
              <input v-model.number="age" class="input" type="number" min="0">
            </label>
            <label class="field">
              <span class="content-field-label">Длительность (с)</span>
              <input v-model.number="duration" class="input" type="number" min="0">
            </label>
          </div>

          <label class="switch-row">
            <input v-model="published" type="checkbox">
            <span>Опубликовано</span>
          </label>

          <label class="field">
            <span class="content-field-label">Сериал</span>
            <select v-model="selectedSeries" class="select">
              <option value="">Без сериала</option>
              <option v-for="option in seriesOptions" :key="String(option.value)" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <div class="field">
            <span class="content-field-label">Теги</span>
            <div class="tag-list">
              <button
                v-for="tag in tagOptions"
                :key="tag"
                class="tag-chip"
                :class="{ active: tags.includes(tag) }"
                type="button"
                @click="toggleTag(tag)"
              >
                {{ tag }}
              </button>
            </div>
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
