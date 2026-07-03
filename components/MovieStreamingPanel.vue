<script setup lang="ts">
import type { ApiErrorInfo } from '~/types/api'
import type { StreamingState } from '~/types/streaming'

const props = defineProps<{
  movieId: string | number
  movie: Record<string, unknown>
}>()

const emit = defineEmits<{
  updated: []
}>()

const api = useApi()
const uploadQueue = useUploadQueueStore()
const config = useRuntimeConfig()

// The live API namespaces movie sub-resources under /v1/content/movies/{id}
// (like /poster, /tags), while the reference backend exposes /v1/content/{id}.
// Probe both and remember whichever answers, mirroring MovieMediaPanel.
const BASE_TEMPLATES = ['/v1/content/movies/{id}', '/v1/content/{id}']
const POLL_INTERVAL_MS = 4000

const resolvedBase = ref<string | null>(null)
const state = ref<StreamingState>(normalizeStreamingState(props.movie))
const loading = ref(false)
const uploading = ref(false)
const reprocessing = ref(false)
const error = ref<ApiErrorInfo | null>(null)
const notice = ref('')
const formKey = ref(0)

const files = reactive<Record<string, File | null>>({ video: null })
const selectedDefaultAudio = ref('')

let pollHandle: ReturnType<typeof setTimeout> | null = null
let disposed = false

const audioSlots = STREAMING_AUDIO_SLOTS
const subtitleSlots = STREAMING_SUBTITLE_SLOTS
const defaultAudioOptions = STREAMING_DEFAULT_AUDIO_OPTIONS

const statusLabel = computed(() => streamingStatusLabel(state.value.streamingStatus))
const statusTone = computed(() => streamingStatusTone(state.value.streamingStatus))
const isProcessing = computed(() => isStreamingProcessing(state.value.streamingStatus))
const durationLabel = computed(() => formatStreamingDuration(state.value.durationSeconds))
const hlsUrl = computed(() => state.value.hlsUrl || '')
const hasAssets = computed(() => hasStreamingSignal(state.value))
const defaultAudioLabel = computed(() => {
  const code = state.value.defaultAudioLanguage
  return code ? STREAMING_LANGUAGE_LABELS[code as keyof typeof STREAMING_LANGUAGE_LABELS] || code : '—'
})

const hasSelectedFiles = computed(() => Object.values(files).some(Boolean))
const canSubmit = computed(() => !uploading.value && (hasSelectedFiles.value || Boolean(selectedDefaultAudio.value)))
const canReprocess = computed(() => hasAssets.value && !reprocessing.value && !isProcessing.value)

onMounted(loadState)
onBeforeUnmount(() => {
  disposed = true
  clearPoll()
})

function streamingEndpoint(baseTemplate: string, suffix = ''): string {
  return resolveEndpoint(`${baseTemplate}/streaming-assets${suffix}`, { id: props.movieId })
}

function clearPoll() {
  if (pollHandle) {
    clearTimeout(pollHandle)
    pollHandle = null
  }
}

function schedulePoll() {
  clearPoll()
  if (disposed || !isProcessing.value) return
  pollHandle = setTimeout(() => loadState(true), POLL_INTERVAL_MS)
}

function applyState(next: StreamingState) {
  state.value = next
  schedulePoll()
}

async function loadState(silent = false) {
  if (!silent) {
    loading.value = true
    error.value = null
  }

  const bases = resolvedBase.value ? [resolvedBase.value] : BASE_TEMPLATES
  let lastError: ApiErrorInfo | null = null

  for (const base of bases) {
    try {
      const response = await api.get(streamingEndpoint(base))
      resolvedBase.value = base
      applyState(normalizeStreamingState(response))
      loading.value = false
      return
    } catch (requestError) {
      lastError = requestError as ApiErrorInfo
    }
  }

  loading.value = false
  // A 404 just means "no assets yet" or the route lives under the other base —
  // keep the seeded state and stay quiet. Surface anything else.
  if (!silent && lastError && lastError.statusCode !== 404) {
    error.value = lastError
  }
}

function onPick(field: string, event: Event) {
  files[field] = (event.target as HTMLInputElement).files?.[0] || null
}

function resetForm() {
  for (const key of Object.keys(files)) files[key] = null
  selectedDefaultAudio.value = ''
  formKey.value += 1
}

async function ensureBase(): Promise<string> {
  if (!resolvedBase.value) await loadState(true)
  return resolvedBase.value || BASE_TEMPLATES[0]
}

async function submit() {
  if (!canSubmit.value) return

  uploading.value = true
  error.value = null
  notice.value = ''

  try {
    const base = await ensureBase()
    const body = new FormData()

    for (const [field, file] of Object.entries(files)) {
      if (file) body.append(field, file)
    }
    if (selectedDefaultAudio.value) body.append('defaultAudioLanguage', selectedDefaultAudio.value)

    uploadQueue.enqueue({
      endpoint: streamingEndpoint(base),
      method: 'POST',
      body,
      label: `Стриминг: ${movieTitle()}`
    })

    resetForm()
    notice.value = 'Загрузка запущена в фоне. Прогресс — в очереди загрузок. Статус обновится автоматически.'
    // Nudge polling until the server registers the new upload.
    pollLater()
    emit('updated')
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    uploading.value = false
  }
}

function pollLater() {
  clearPoll()
  if (disposed) return
  pollHandle = setTimeout(() => loadState(true), 6000)
}

async function reprocess() {
  if (!canReprocess.value) return

  reprocessing.value = true
  error.value = null
  notice.value = ''

  try {
    const base = await ensureBase()
    const response = await api.post(streamingEndpoint(base, '/reprocess'))
    applyState(normalizeStreamingState(response))
    notice.value = 'Повторная обработка запущена.'
    emit('updated')
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    reprocessing.value = false
  }
}

async function copyHls() {
  if (!hlsUrl.value || !process.client || !navigator.clipboard) return
  try {
    await navigator.clipboard.writeText(hlsUrl.value)
    notice.value = 'HLS-ссылка скопирована.'
  } catch {
    notice.value = ''
  }
}

function movieTitle(): string {
  return pickLocalized(getResourceValue(props.movie, 'title')) || String(props.movieId)
}

function trackUrl(value: string | null): string {
  if (!value) return ''
  const source = normalizeMediaPath(value)
  if (!source) return ''
  if (/^(https?:|data:|blob:)/i.test(source)) return source
  const baseUrl = String(config.public.apiBaseUrl || '').replace(/\/$/, '')
  return `${baseUrl}/${source.replace(/^\//, '')}`
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <div>
        <h2 style="margin: 0; font-size: 18px;">Мультиаудио стриминг</h2>
        <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">
          Видео, звуковые дорожки (UZ / RU / EN) и субтитры в одном HLS-мастере.
        </p>
      </div>
      <div class="streaming-header-actions">
        <button class="button secondary" type="button" :disabled="loading" @click="loadState(false)">
          <AppIcon :name="loading ? 'i-lucide-loader-circle' : 'i-lucide-refresh-cw'" :spin="loading" />
          Обновить
        </button>
        <button
          v-if="canReprocess"
          class="button secondary"
          type="button"
          :disabled="reprocessing"
          @click="reprocess"
        >
          <AppIcon :name="reprocessing ? 'i-lucide-loader-circle' : 'i-lucide-refresh-ccw-dot'" :spin="reprocessing" />
          Переобработать
        </button>
      </div>
    </div>

    <div class="panel-body">
      <ApiErrorAlert :error="error" />
      <p v-if="notice" class="streaming-notice">
        <AppIcon name="i-lucide-info" />
        {{ notice }}
      </p>

      <!-- Current state -->
      <div class="streaming-summary">
        <div class="streaming-summary-row">
          <span class="table-tag status-tag" :class="statusTone">{{ statusLabel }}</span>
          <span class="streaming-meta">Длительность: <strong>{{ durationLabel }}</strong></span>
          <span class="streaming-meta">Основная дорожка: <strong>{{ defaultAudioLabel }}</strong></span>
        </div>
        <div v-if="isProcessing" class="thin-progress streaming-indeterminate"><span /></div>

        <p v-if="state.processingError" class="streaming-error-text">
          <AppIcon name="i-lucide-triangle-alert" />
          {{ state.processingError }}
        </p>

        <div v-if="hlsUrl" class="streaming-hls">
          <span class="field-label">HLS master</span>
          <div class="streaming-hls-row">
            <code class="streaming-hls-url">{{ hlsUrl }}</code>
            <button class="button icon" type="button" title="Скопировать" @click="copyHls">
              <AppIcon name="i-lucide-copy" />
            </button>
            <a class="button icon" :href="hlsUrl" target="_blank" rel="noopener" title="Открыть">
              <AppIcon name="i-lucide-external-link" />
            </a>
          </div>
        </div>
      </div>

      <!-- Existing tracks -->
      <div class="streaming-tracks">
        <div>
          <span class="field-label">Аудиодорожки</span>
          <div class="streaming-chips">
            <span
              v-for="track in state.audioTracks"
              :key="`audio-${track.languageCode}`"
              class="tag-chip removable"
              :class="{ active: track.isDefault }"
            >
              <AppIcon v-if="track.isDefault" name="i-lucide-star" />
              {{ track.label }}
              <a v-if="trackUrl(track.url)" :href="trackUrl(track.url)" target="_blank" rel="noopener" title="Плейлист">
                <AppIcon name="i-lucide-link" />
              </a>
            </span>
            <span v-if="!state.audioTracks.length" class="streaming-empty">нет дорожек</span>
          </div>
        </div>

        <div>
          <span class="field-label">Субтитры</span>
          <div class="streaming-chips">
            <span
              v-for="subtitle in state.subtitles"
              :key="`sub-${subtitle.languageCode}`"
              class="tag-chip removable"
            >
              {{ subtitle.label }}
              <a v-if="trackUrl(subtitle.url)" :href="trackUrl(subtitle.url)" target="_blank" rel="noopener" title="Файл .vtt">
                <AppIcon name="i-lucide-link" />
              </a>
            </span>
            <span v-if="!state.subtitles.length" class="streaming-empty">нет субтитров</span>
          </div>
        </div>
      </div>

      <!-- Upload form -->
      <div :key="formKey" class="streaming-upload">
        <span class="field-label">Загрузить / заменить ассеты</span>
        <p class="streaming-hint">
          Видео обязательно при первой загрузке. Аудиодорожки должны совпадать по длительности с видео (допуск ±1.5 c).
        </p>

        <div class="streaming-upload-grid">
          <label class="streaming-slot streaming-slot-video">
            <input hidden type="file" accept=".mp4,.mov,.mkv,video/*" @change="onPick('video', $event)">
            <span class="streaming-slot-head">
              <AppIcon name="i-lucide-clapperboard" />
              Основное видео
            </span>
            <span class="streaming-slot-file">{{ files.video?.name || 'Файл не выбран' }}</span>
          </label>

          <label v-for="slot in audioSlots" :key="slot.field" class="streaming-slot">
            <input hidden type="file" :accept="slot.accept" @change="onPick(slot.field, $event)">
            <span class="streaming-slot-head">
              <AppIcon name="i-lucide-audio-lines" />
              {{ slot.label }}
            </span>
            <span class="streaming-slot-file">{{ files[slot.field]?.name || 'Файл не выбран' }}</span>
          </label>

          <label v-for="slot in subtitleSlots" :key="slot.field" class="streaming-slot">
            <input hidden type="file" :accept="slot.accept" @change="onPick(slot.field, $event)">
            <span class="streaming-slot-head">
              <AppIcon name="i-lucide-captions" />
              {{ slot.label }}
            </span>
            <span class="streaming-slot-file">{{ files[slot.field]?.name || 'Файл не выбран' }}</span>
          </label>
        </div>

        <div class="streaming-default">
          <label class="field-label" for="streaming-default-audio">Основная аудиодорожка</label>
          <select id="streaming-default-audio" v-model="selectedDefaultAudio" class="select">
            <option value="">Оставить текущую</option>
            <option v-for="option in defaultAudioOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="content-modal-actions">
          <button class="button" type="button" :disabled="!canSubmit" @click="submit">
            <AppIcon :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-upload-cloud'" :spin="uploading" />
            {{ uploading ? 'Постановка в очередь...' : 'Загрузить и обработать' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.streaming-header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.streaming-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px;
  padding: 8px 12px;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--primary) 8%, var(--surface));
  color: var(--primary);
  font-size: 13px;
}

.streaming-summary {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-soft);
  margin-bottom: 16px;
}

.streaming-summary-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.streaming-meta {
  font-size: 13px;
  color: var(--muted);
}

.streaming-meta strong {
  color: var(--text);
}

.streaming-indeterminate {
  margin-top: 10px;
}

.streaming-indeterminate span {
  width: 40%;
  animation: streaming-slide 1.2s ease-in-out infinite;
}

@keyframes streaming-slide {
  0% { margin-left: 0; }
  50% { margin-left: 60%; }
  100% { margin-left: 0; }
}

.streaming-error-text {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 12px 0 0;
  color: var(--danger);
  font-size: 13px;
}

.streaming-hls {
  margin-top: 14px;
}

.streaming-hls-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.streaming-hls-url {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  white-space: nowrap;
  padding: 6px 10px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text);
}

.streaming-tracks {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-bottom: 18px;
}

.streaming-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.streaming-chips .tag-chip a {
  display: inline-flex;
  color: inherit;
}

.streaming-empty {
  font-size: 12px;
  color: var(--muted);
  font-style: italic;
}

.streaming-hint {
  margin: 4px 0 12px;
  font-size: 12px;
  color: var(--muted);
}

.streaming-upload-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.streaming-slot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  cursor: pointer;
  transition: border-color var(--duration-fast, 150ms), background var(--duration-fast, 150ms);
}

.streaming-slot:hover {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  background: color-mix(in srgb, var(--primary) 5%, var(--surface));
}

.streaming-slot-video {
  grid-column: 1 / -1;
  border-style: solid;
}

.streaming-slot-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 640;
  color: var(--text);
}

.streaming-slot-file {
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.streaming-default {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
  max-width: 280px;
}
</style>
