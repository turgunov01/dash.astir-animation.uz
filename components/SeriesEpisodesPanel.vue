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
const deletingEpisode = ref(false)
const deleteTarget = ref<Record<string, unknown> | null>(null)
const handledUploadTaskIds = new Set<string>()
const episodeUploadTaskIds = new Set<string>()

const episodeListEndpoint = computed(() => `/api/v1/series/${encodeURIComponent(String(props.seriesId))}/episodes`)
const episodeUploadEndpoint = '/v1/content/movies/create'
const episodeUploadActive = computed(() =>
  uploadQueue.tasks.some((task) => episodeUploadTaskIds.has(task.id) && ['queued', 'uploading', 'processing'].includes(task.status))
)
const deleteEpisodeMessage = computed(() => {
  const title = deleteTarget.value ? episodeTitle(deleteTarget.value) : ''
  return title
    ? `Эпизод «${title}» будет удалён без возможности восстановления.`
    : 'Эпизод будет удалён без возможности восстановления.'
})

watch(
  () => props.seriesId,
  () => {
    episodes.value = []
    handledUploadTaskIds.clear()
    episodeUploadTaskIds.clear()
    deleteTarget.value = null
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
        episodeUploadTaskIds.has(task.id) &&
        ['success', 'error', 'cancelled'].includes(task.status) &&
        task.completedAt &&
        !handledUploadTaskIds.has(task.id)
    )

    for (const task of finished) handledUploadTaskIds.add(task.id)

    const failed = finished.find((task) => task.status === 'error')
    if (failed) {
      const details = [
        failed.responseStatus ? `Статус: ${failed.responseStatus}` : '',
        `Endpoint: ${failed.endpoint}`
      ].filter(Boolean).join('. ')

      formError.value = {
        message: `${failed.error || 'Не удалось загрузить эпизод.'}${details ? ` ${details}.` : ''}`,
        statusCode: failed.responseStatus
      }
      queuedMessage.value = ''
    }

    if (finished.some((task) => task.status === 'success')) {
      resetForm()
      queuedMessage.value = 'Эпизод загружен.'
      void loadEpisodes()
      emit('updated')
    }
  }
)

onMounted(loadEpisodes)

async function loadEpisodes() {
  loadingEpisodes.value = true
  error.value = null

  try {
    const response = await api.get(episodeListEndpoint.value, { page: 1, limit: 500 })
    const rows = normalizeList(response, ['series', 'episodes', 'movies']).items
    episodes.value = sortEpisodes(uniqueEpisodes(rows))
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

  if (!hasAllLocalizedText(title.value)) {
    formError.value = { message: 'Заполните название эпизода на RU, UZ и EN.' }
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

  const { task } = uploadQueue.enqueue({
    endpoint: episodeUploadEndpoint,
    method: 'POST',
    body,
    label: `Эпизод: ${pickLocalized(title.value) || videoFile.value.name}`,
    resultRouteBase: '/content/movies'
  })
  episodeUploadTaskIds.add(task.id)

  queuedMessage.value = 'Эпизод поставлен в очередь загрузки.'
}

function buildEpisodeMetadata(): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    title: title.value,
    description: description.value,
    is_premium: isPremium.value,
    content_type: 'episode',
    series_id: String(props.seriesId)
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

function hasAllLocalizedText(value: LocalizedText) {
  return ['ru', 'uz', 'en'].every((locale) => String(value[locale as keyof LocalizedText] || '').trim())
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

function episodeContentRoute(row: Record<string, unknown>) {
  if (!isContentMovieEpisode(row)) return ''

  const id = getItemId(row)
  return id === undefined ? '' : `/content/movies/${encodeURIComponent(String(id))}`
}

function canDeleteEpisode(row: Record<string, unknown>) {
  return getItemId(row) !== undefined
}

async function confirmDeleteEpisode() {
  if (!deleteTarget.value) return

  const id = getItemId(deleteTarget.value)
  if (id === undefined) return

  deletingEpisode.value = true
  error.value = null

  try {
    await api.remove(resolveEndpoint('/v1/content/movies/{id}', { id, ...deleteTarget.value }))
    deleteTarget.value = null
    await loadEpisodes()
    emit('updated')
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    deletingEpisode.value = false
  }
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
  return transcodeStatusLabel(row)
}

function episodeStatusTone(row: Record<string, unknown>) {
  return transcodeStatusTone(row)
}

function episodeProgressVisible(row: Record<string, unknown>) {
  return transcodeProgressVisible(row)
}

function episodeProgressPercent(row: Record<string, unknown>) {
  return transcodeProgressPercent(row) ?? 0
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
  const source = normalizeMediaPath(value)
  if (!source) return ''
  if (/^(https?:|data:|blob:)/i.test(source)) return source

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
          <button class="button" type="submit" :disabled="episodeUploadActive">
            <AppIcon name="i-lucide-upload-cloud" />
            {{ episodeUploadActive ? 'Загрузка...' : 'Загрузить эпизод' }}
          </button>
        </div>
      </form>

      <div class="series-episode-list">
        <ApiErrorAlert :error="error" />
        <div v-if="loadingEpisodes" class="loading-state">Загрузка эпизодов...</div>
        <div v-else-if="!episodes.length" class="empty-state" style="min-height: 120px;">Эпизоды пока не добавлены</div>
        <div v-else class="table-wrap series-episode-table">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 90px;">№</th>
                  <th>Название</th>
                  <th>Статус</th>
                  <th>Контент</th>
                  <th>Видео</th>
                  <th>Создан</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="episode in episodes" :key="String(getItemId(episode) || episodeTitle(episode))">
                  <td><strong>{{ episodeNumberLabel(episode) }}</strong></td>
                  <td>{{ episodeTitle(episode) }}</td>
                  <td>
                    <span class="table-tag status-tag" :class="episodeStatusTone(episode)">{{ episodeStatus(episode) }}</span>
                    <div v-if="episodeProgressVisible(episode)" class="thin-progress" :title="`${episodeProgressPercent(episode)}%`">
                      <span :style="{ width: `${episodeProgressPercent(episode)}%` }" />
                    </div>
                  </td>
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
                  <td>
                    <button
                      v-if="canDeleteEpisode(episode)"
                      class="icon-link danger-link"
                      type="button"
                      title="Удалить"
                      :disabled="deletingEpisode"
                      @click="deleteTarget = episode"
                    >
                      <AppIcon name="i-lucide-trash-2" />
                    </button>
                    <span v-else>—</span>
                  </td>
                </tr>
              </tbody>
            </table>
        </div>
      </div>
    </div>

    <ConfirmDeleteModal
      :model-value="Boolean(deleteTarget)"
      title="Удалить эпизод?"
      :message="deleteEpisodeMessage"
      :loading="deletingEpisode"
      @update:model-value="deleteTarget = null"
      @confirm="confirmDeleteEpisode"
    />
  </div>
</template>
