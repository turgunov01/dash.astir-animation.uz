<script setup lang="ts">
import type { ApiErrorInfo } from '~/types/api'

const props = defineProps<{
  movieId: string | number
  movie: Record<string, unknown>
}>()

const emit = defineEmits<{
  updated: []
}>()

const api = useApi()
const config = useRuntimeConfig()

const posterInput = ref<HTMLInputElement | null>(null)
const posterFile = ref<File | null>(null)
const posterSaving = ref(false)
const error = ref<ApiErrorInfo | null>(null)

const posterPreview = computed(() => {
  if (posterFile.value && process.client) return URL.createObjectURL(posterFile.value)
  return currentPosterUrl.value
})
const currentPosterUrl = computed(() => mediaUrl(moviePosterPath(props.movie)))
const statusLabel = computed(() => transcodeStatusLabel(props.movie))
const statusTone = computed(() => transcodeStatusTone(props.movie))
const progressVisible = computed(() => transcodeProgressVisible(props.movie))
const progressPercent = computed(() => transcodeProgressPercent(props.movie) ?? 0)

async function uploadPoster() {
  if (!posterFile.value) {
    posterInput.value?.click()
    return
  }

  posterSaving.value = true
  error.value = null

  try {
    await requestFirstSuccessful(buildPosterUploadCandidates(posterFile.value))
    posterFile.value = null
    emit('updated')
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    posterSaving.value = false
  }
}

function buildPosterUploadCandidates(file: File) {
  const id = props.movieId
  const posterBody = new FormData()
  posterBody.append('poster', file)

  const metadataPosterBody = buildMetadataFormData({})
  metadataPosterBody.append('poster', file)

  const fileBody = new FormData()
  fileBody.append('file', file)

  return [
    { endpoint: `/v1/content/movies/${encodeURIComponent(String(id))}/poster`, method: 'POST' as const, body: fileBody },
    { endpoint: `/v1/content/movies/${encodeURIComponent(String(id))}/poster`, method: 'POST' as const, body: posterBody },
    { endpoint: `/v1/content/movies/${encodeURIComponent(String(id))}`, method: 'PATCH' as const, body: metadataPosterBody },
    { endpoint: `/v1/content/movies/${encodeURIComponent(String(id))}`, method: 'PATCH' as const, body: posterBody }
  ]
}

function buildMetadataFormData(patch: Record<string, unknown>) {
  const metadata: Record<string, unknown> = { ...patch }

  for (const key of ['title', 'description', 'category_id', 'series_id', 'year', 'age_rating', 'duration_sec', 'published', 'is_premium', 'tag_ids']) {
    if (metadata[key] !== undefined) continue
    const value = getResourceValue(props.movie, key)
    if (value !== undefined && value !== null && value !== '') metadata[key] = value
  }

  const formData = new FormData()
  formData.append('metadata', JSON.stringify(metadata))
  return formData
}

async function requestFirstSuccessful(
  candidates: Array<{ endpoint: string; method: 'POST' | 'PATCH'; body: unknown }>
) {
  let lastError: unknown

  for (const candidate of candidates) {
    try {
      return await api.request(candidate.endpoint, {
        method: candidate.method,
        body: candidate.body
      })
    } catch (requestError) {
      lastError = requestError
    }
  }

  throw lastError
}

function moviePosterPath(movie: Record<string, unknown>) {
  const value =
    getResourceValue(movie, 'poster_url') ??
    getResourceValue(movie, 'posterUrl') ??
    getResourceValue(movie, 'poster.url') ??
    getResourceValue(movie, 'poster') ??
    getResourceValue(movie, 'image_url') ??
    getResourceValue(movie, 'image') ??
    getResourceValue(movie, 'thumbnail_url') ??
    getResourceValue(movie, 'thumbnail')

  return pickMediaPath(value)
}

function mediaUrl(value: unknown): string {
  const source = String(value || '')
  if (!source) return ''
  if (/^https?:\/\//i.test(source)) return source

  const baseUrl = String(config.public.apiBaseUrl || '').replace(/\/$/, '')
  return `${baseUrl}/${source.replace(/^\//, '')}`
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <div>
        <h2 style="margin: 0; font-size: 18px;">Постер</h2>
        <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">Постер фильма в каталоге.</p>
      </div>
    </div>

    <div class="panel-body">
      <ApiErrorAlert :error="error" />

      <div class="movie-media-panel">
        <button class="movie-poster-preview" type="button" @click="posterInput?.click()">
          <img v-if="posterPreview" :src="posterPreview" alt="">
          <span v-else>
            <AppIcon name="i-lucide-image" />
            Нет постера
          </span>
        </button>

        <div class="movie-media-actions">
          <div class="movie-transcode-status">
            <span class="table-tag status-tag" :class="statusTone">{{ statusLabel }}</span>
            <div v-if="progressVisible" class="thin-progress" :title="`${progressPercent}%`">
              <span :style="{ width: `${progressPercent}%` }" />
            </div>
          </div>

          <input
            ref="posterInput"
            hidden
            type="file"
            accept="image/*"
            @change="posterFile = ($event.target as HTMLInputElement).files?.[0] || null"
          >
          <button class="button secondary" type="button" @click="posterInput?.click()">
            <AppIcon name="i-lucide-image-plus" />
            {{ posterFile ? posterFile.name : 'Выбрать постер' }}
          </button>
          <button class="button" type="button" :disabled="posterSaving || !posterFile" @click="uploadPoster">
            <AppIcon :name="posterSaving ? 'i-lucide-loader-circle' : 'i-lucide-upload-cloud'" :spin="posterSaving" />
            {{ posterSaving ? 'Загрузка...' : 'Сохранить постер' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
