<script setup lang="ts">
import type { ApiErrorInfo, LocalizedText } from '~/types/api'

const props = defineProps<{
  seriesId: string | number
  series?: Record<string, unknown> | null
}>()

const emit = defineEmits<{
  updated: []
}>()

const api = useApi()
const config = useRuntimeConfig()
const uploadQueue = useUploadQueueStore()

const title = ref<LocalizedText>({ ru: '', uz: '', en: '' })
const description = ref<LocalizedText>({ ru: '', uz: '', en: '' })
const seasonNumber = ref(1)
const episodeNumber = ref(1)
const isPremium = ref(false)
const videoFile = ref<File | null>(null)
const posterFile = ref<File | null>(null)
const fileInputKey = ref(0)
const loadingEpisodes = ref(false)
const episodes = ref<Record<string, unknown>[]>([])
const error = ref<ApiErrorInfo | null>(null)
const formError = ref<ApiErrorInfo | null>(null)
const queuedMessage = ref('')
const handledUploadTaskIds = new Set<string>()

const episodeUploadEndpoint = computed(() => `/api/v1/series/${encodeURIComponent(String(props.seriesId))}/episodes`)

watch(
  () => props.seriesId,
  () => {
    episodes.value = []
    resetForm()
    void loadEpisodes()
  }
)

watch(
  () => getResourceValue(props.series, 'is_premium'),
  (value) => {
    isPremium.value = normalizeBoolean(value)
  },
  { immediate: true }
)

watch(
  () => uploadQueue.tasks.map((task) => `${task.id}:${task.endpoint}:${task.status}:${task.completedAt || ''}`).join('|'),
  () => {
    const finished = uploadQueue.tasks.filter(
      (task) =>
        task.endpoint === episodeUploadEndpoint.value &&
        ['success', 'error', 'cancelled'].includes(task.status) &&
        task.completedAt &&
        !handledUploadTaskIds.has(task.id)
    )

    for (const task of finished) handledUploadTaskIds.add(task.id)

    const failed = finished.find((task) => task.status === 'error')
    if (failed) {
      formError.value = {
        message: failed.error || 'Не удалось загрузить эпизод.',
        statusCode: failed.responseStatus
      }
      queuedMessage.value = ''
    }

    if (finished.some((task) => task.status === 'success')) {
      void loadEpisodes()
      emit('updated')
    }
  }
)

onMounted(loadEpisodes)

async function loadEpisodes() {
  loadingEpisodes.value = true
  error.value = null

  const id = encodeURIComponent(String(props.seriesId))
  try {
    const response = await api.get(`/api/v1/series/${id}/episodes`)
    episodes.value = sortEpisodes(uniqueEpisodes(normalizeList(response, 'episodes').items))
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
    episodes.value = []
  } finally {
    loadingEpisodes.value = false
  }
}

function submitEpisode() {
  formError.value = null
  queuedMessage.value = ''

  if (!hasLocalizedText(title.value)) {
    formError.value = { message: 'Заполните название эпизода хотя бы на одном языке.' }
    return
  }

  if (!videoFile.value) {
    formError.value = { message: 'Выберите видео эпизода.' }
    return
  }

  const metadata = buildEpisodeMetadata()
  const body = new FormData()
  body.append('metadata', JSON.stringify(metadata))
  body.append('video', videoFile.value)
  if (posterFile.value) body.append('poster', posterFile.value)

  uploadQueue.enqueue({
    endpoint: episodeUploadEndpoint.value,
    method: 'POST',
    body,
    label: `Эпизод: ${pickLocalized(title.value) || videoFile.value.name}`,
    resultRouteBase: '/content/series'
  })

  queuedMessage.value = 'Эпизод поставлен в очередь загрузки.'
  episodeNumber.value += 1
  title.value = { ru: '', uz: '', en: '' }
  description.value = { ru: '', uz: '', en: '' }
  videoFile.value = null
  posterFile.value = null
  fileInputKey.value += 1
}

function buildEpisodeMetadata(): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    title: title.value,
    description: description.value,
    is_premium: isPremium.value
  }

  const season = normalizePositiveInteger(seasonNumber.value)
  const episode = normalizePositiveInteger(episodeNumber.value)
  if (season !== undefined) metadata.season_number = season
  if (episode !== undefined) metadata.episode_number = episode

  return metadata
}

function resetForm() {
  title.value = { ru: '', uz: '', en: '' }
  description.value = { ru: '', uz: '', en: '' }
  seasonNumber.value = 1
  episodeNumber.value = 1
  videoFile.value = null
  posterFile.value = null
  queuedMessage.value = ''
  formError.value = null
  fileInputKey.value += 1
}

function hasLocalizedText(value: LocalizedText) {
  return Object.values(value).some((entry) => String(entry || '').trim())
}

function uniqueEpisodes(rows: Record<string, unknown>[]) {
  const seen = new Set<string>()

  return rows.filter((row) => {
    const id = getItemId(row) ?? `${episodeOrderValue(row)}:${episodeTitle(row)}`
    const key = String(id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sortEpisodes(rows: Record<string, unknown>[]) {
  return [...rows].sort((left, right) => episodeOrderValue(left) - episodeOrderValue(right))
}

function episodeOrderValue(row: Record<string, unknown>) {
  const season = numberValue(
    getResourceValue(row, 'season_number') ??
    getResourceValue(row, 'seasonNumber') ??
    getResourceValue(row, 'season')
  ) ?? 0
  const episode = numberValue(
    getResourceValue(row, 'episode_number') ??
    getResourceValue(row, 'episodeNumber') ??
    getResourceValue(row, 'episode')
  ) ?? 0

  return season * 10000 + episode
}

function episodeNumberLabel(row: Record<string, unknown>) {
  const season = numberValue(
    getResourceValue(row, 'season_number') ??
    getResourceValue(row, 'seasonNumber') ??
    getResourceValue(row, 'season')
  )
  const episode = numberValue(
    getResourceValue(row, 'episode_number') ??
    getResourceValue(row, 'episodeNumber') ??
    getResourceValue(row, 'episode')
  )

  if (season !== undefined && episode !== undefined) return `${season}.${episode}`
  if (episode !== undefined) return String(episode)
  return '—'
}

function episodeTitle(row: Record<string, unknown>) {
  return (
    pickLocalized(getResourceValue(row, 'title')) ||
    String(getResourceValue(row, 'name') || getResourceValue(row, 'original_name') || 'Без названия')
  )
}

function episodeDescription(row: Record<string, unknown>) {
  return pickLocalized(getResourceValue(row, 'description')) || ''
}

function episodePosterUrl(row: Record<string, unknown>) {
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

function episodeContentRoute(row: Record<string, unknown>) {
  if (!isContentMovieEpisode(row)) return ''

  const id = getItemId(row)
  return id === undefined ? '' : `/content/movies/${encodeURIComponent(String(id))}`
}

function isContentMovieEpisode(row: Record<string, unknown>) {
  return Boolean(
    getResourceValue(row, 'playback') ||
    getResourceValue(row, 'media') ||
    getResourceValue(row, 'transcode_status') ||
    getResourceValue(row, 'video_url') ||
    getResourceValue(row, 'source')
  )
}

function episodeStatus(row: Record<string, unknown>) {
  return (
    getResourceValue(row, 'transcode_status') ||
    getResourceValue(row, 'playback.status') ||
    getResourceValue(row, 'status') ||
    '—'
  )
}

function episodeVideoUrl(row: Record<string, unknown>) {
  const value =
    getResourceValue(row, 'playback.auto_url') ??
    getResourceValue(row, 'playback.hls_url') ??
    getResourceValue(row, 'video_url') ??
    getResourceValue(row, 'videoUrl') ??
    getResourceValue(row, 'source') ??
    getResourceValue(row, 'source_path') ??
    getResourceValue(row, 'sourcePath')
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

function normalizePositiveInteger(value: unknown): number | undefined {
  const number = numberValue(value)
  return number !== undefined && number > 0 ? Math.floor(number) : undefined
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value === 'string') return ['true', '1', 'yes', 'active'].includes(value.trim().toLowerCase())
  return Boolean(value)
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <div>
        <h2 style="margin: 0; font-size: 18px;">Эпизоды</h2>
        <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">Загрузка видео-эпизодов сериала.</p>
      </div>
      <button class="button secondary" type="button" :disabled="loadingEpisodes" @click="loadEpisodes">
        <AppIcon name="i-lucide-refresh-cw" />
        Обновить
      </button>
    </div>

    <div class="panel-body">
      <form class="series-episode-form" @submit.prevent="submitEpisode">
        <ApiErrorAlert :error="formError" />
        <div v-if="queuedMessage" class="badge success">{{ queuedMessage }}</div>

        <LocalizedTextFields v-model="title" label="Название эпизода" />
        <LocalizedTextFields v-model="description" label="Описание" :rows="3" />

        <div class="content-number-grid">
          <label class="field">
            <span class="field-label">Сезон</span>
            <input v-model.number="seasonNumber" class="input" type="number" min="1">
          </label>
          <label class="field">
            <span class="field-label">Эпизод</span>
            <input v-model.number="episodeNumber" class="input" type="number" min="1">
          </label>
        </div>

        <label class="switch-row">
          <input v-model="isPremium" type="checkbox">
          <span>Премиум</span>
        </label>

        <div class="series-episode-files">
          <div class="field">
            <span class="field-label">Видео</span>
            <UploadDropzone
              :key="`video-${fileInputKey}`"
              v-model="videoFile"
              accept="video/*"
              label="Выберите видео эпизода"
            />
          </div>
          <div class="field">
            <span class="field-label">Постер эпизода</span>
            <UploadDropzone
              :key="`poster-${fileInputKey}`"
              v-model="posterFile"
              accept="image/*"
              label="Выберите постер"
            />
          </div>
        </div>

        <div class="series-episode-actions">
          <button class="button secondary" type="button" @click="resetForm">
            Сбросить
          </button>
          <button class="button" type="submit">
            <AppIcon name="i-lucide-upload-cloud" />
            Загрузить эпизод
          </button>
        </div>
      </form>

      <div class="series-episode-list">
        <ApiErrorAlert :error="error" />
        <div v-if="loadingEpisodes" class="loading-state">Загрузка эпизодов...</div>
        <div v-else-if="!episodes.length" class="empty-state" style="min-height: 120px;">Эпизоды пока не добавлены</div>
        <div v-else>
          <div class="series-episode-cards">
            <article
              v-for="episode in episodes"
              :key="String(getItemId(episode) || episodeTitle(episode))"
              class="series-episode-card"
            >
              <div class="series-episode-card-poster">
                <img v-if="episodePosterUrl(episode)" :src="episodePosterUrl(episode)" alt="">
                <AppIcon v-else name="i-lucide-film" />
              </div>

              <div class="series-episode-card-body">
                <div class="series-episode-card-head">
                  <span class="age-pill">{{ episodeNumberLabel(episode) }}</span>
                  <StatusBadge :value="episodeStatus(episode)" />
                </div>
                <h3>{{ episodeTitle(episode) }}</h3>
                <p>{{ episodeDescription(episode) || 'Описание не заполнено' }}</p>

                <div class="series-episode-card-actions">
                  <NuxtLink
                    v-if="episodeContentRoute(episode)"
                    class="button secondary"
                    :to="episodeContentRoute(episode)"
                  >
                    <AppIcon name="i-lucide-folder-open" />
                    Открыть контент
                  </NuxtLink>
                  <a
                    v-if="episodeVideoUrl(episode)"
                    class="button secondary"
                    :href="episodeVideoUrl(episode)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <AppIcon name="i-lucide-play" />
                    Смотреть
                  </a>
                </div>
              </div>
            </article>
          </div>

          <div class="table-wrap series-episode-table">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 90px;">№</th>
                  <th>Название</th>
                  <th>Статус</th>
                  <th>Контент</th>
                  <th>Видео</th>
                  <th>Создан</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="episode in episodes" :key="String(getItemId(episode) || episodeTitle(episode))">
                  <td><strong>{{ episodeNumberLabel(episode) }}</strong></td>
                  <td>{{ episodeTitle(episode) }}</td>
                  <td><StatusBadge :value="episodeStatus(episode)" /></td>
                  <td>
                    <NuxtLink v-if="episodeContentRoute(episode)" class="button secondary" :to="episodeContentRoute(episode)">
                      <AppIcon name="i-lucide-folder-open" />
                      Открыть
                    </NuxtLink>
                    <span v-else>—</span>
                  </td>
                  <td>
                    <a v-if="episodeVideoUrl(episode)" class="button secondary" :href="episodeVideoUrl(episode)" target="_blank" rel="noreferrer">
                      <AppIcon name="i-lucide-play" />
                      Смотреть
                    </a>
                    <span v-else>—</span>
                  </td>
                  <td><DateTimeCell :value="getResourceValue(episode, 'createdAt') || getResourceValue(episode, 'created_at')" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
