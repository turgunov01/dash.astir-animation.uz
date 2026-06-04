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
const isPremium = ref(false)
const seriesKind = ref<'seasons' | 'episodes'>('seasons')
const seriesActive = ref(true)
const selectedTagIds = ref<string[]>([])
const freeFormTags = ref<string[]>([])
const poster = ref<File | null>(null)
const video = ref<File | null>(null)
const posterInput = ref<HTMLInputElement | null>(null)
const videoInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const error = ref<ApiErrorInfo | null>(null)

const locales = ['uz', 'ru', 'en'] as const
const posterPreview = computed(() => (poster.value && process.client ? URL.createObjectURL(poster.value) : ''))
const pageTitle = computed(() => (props.contentType === 'series' ? 'Новый сериал' : 'Новый фильм'))

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

    if (video.value) {
      const body = new FormData()
      body.append('metadata', JSON.stringify(buildMovieMetadata()))
      body.append('video', video.value)
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
  return {
    title: title.value,
    description: description.value,
    is_premium: isPremium.value,
    tag_ids: selectedTagIds.value,
    tags: freeFormTags.value
  }
}

function getCreatedId(payload: unknown) {
  const data = unwrapPayload<Record<string, unknown>>(payload)
  return getItemId(data) || getItemId(data?.movie) || getItemId(data?.content) || getItemId(data?.series)
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
          <template v-if="contentType === 'series'">
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
