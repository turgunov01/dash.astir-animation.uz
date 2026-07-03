import { getResourceValue } from '~/utils/data'
import type {
  StreamingAudioTrack,
  StreamingLanguage,
  StreamingState,
  StreamingSubtitleTrack,
  StreamingUploadSlot
} from '~/types/streaming'

export const STREAMING_LANGUAGES: StreamingLanguage[] = ['uz', 'ru', 'en']

export const STREAMING_LANGUAGE_LABELS: Record<StreamingLanguage, string> = {
  uz: 'Узбекский',
  ru: 'Русский',
  en: 'Английский'
}

export const STREAMING_DEFAULT_AUDIO_OPTIONS = STREAMING_LANGUAGES.map((language) => ({
  label: STREAMING_LANGUAGE_LABELS[language],
  value: language
}))

const AUDIO_ACCEPT = '.mp3,.wav,.m4a,.aac,audio/*'
const SUBTITLE_ACCEPT = '.vtt,text/vtt'

export const STREAMING_AUDIO_SLOTS: StreamingUploadSlot[] = STREAMING_LANGUAGES.map((language) => ({
  field: `audio_${language}`,
  language,
  label: `Аудио — ${STREAMING_LANGUAGE_LABELS[language]}`,
  accept: AUDIO_ACCEPT
}))

export const STREAMING_SUBTITLE_SLOTS: StreamingUploadSlot[] = STREAMING_LANGUAGES.map((language) => ({
  field: `subtitle_${language}`,
  language,
  label: `Субтитры — ${STREAMING_LANGUAGE_LABELS[language]}`,
  accept: SUBTITLE_ACCEPT
}))

const STATUS_LABELS: Record<string, string> = {
  uploaded: 'В очереди',
  processing: 'Обработка',
  ready: 'Готово',
  failed: 'Ошибка'
}

const STATUS_TONES: Record<string, string> = {
  uploaded: 'warning',
  processing: 'warning',
  ready: 'success',
  failed: 'danger'
}

export function streamingStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Не загружено'
  return STATUS_LABELS[status] || status
}

export function streamingStatusTone(status: string | null | undefined): string {
  if (!status) return 'neutral'
  return STATUS_TONES[status] || 'neutral'
}

export function isStreamingProcessing(status: string | null | undefined): boolean {
  return status === 'uploaded' || status === 'processing'
}

export function formatStreamingDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—'

  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`
}

function readString(source: unknown, ...paths: string[]): string | null {
  for (const path of paths) {
    const value = getResourceValue(source, path)
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return null
}

function readNumber(source: unknown, ...paths: string[]): number | null {
  for (const path of paths) {
    const value = getResourceValue(source, path)
    const number = Number(value)
    if (Number.isFinite(number) && number > 0) return number
  }
  return null
}

function readBoolean(source: unknown, ...paths: string[]): boolean {
  for (const path of paths) {
    const value = getResourceValue(source, path)
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value > 0
    if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.trim().toLowerCase())
  }
  return false
}

function normalizeAudioTrack(raw: unknown): StreamingAudioTrack {
  const languageCode = readString(raw, 'languageCode', 'language_code', 'language') || ''
  return {
    languageCode,
    label: readString(raw, 'label', 'name') || STREAMING_LANGUAGE_LABELS[languageCode as StreamingLanguage] || languageCode,
    isDefault: readBoolean(raw, 'isDefault', 'is_default'),
    url: readString(raw, 'url', 'hls_playlist_url', 'hlsPlaylistUrl', 'playlist_url', 'playlistUrl')
  }
}

function normalizeSubtitleTrack(raw: unknown): StreamingSubtitleTrack {
  const languageCode = readString(raw, 'languageCode', 'language_code', 'language') || ''
  return {
    languageCode,
    label: readString(raw, 'label', 'name') || STREAMING_LANGUAGE_LABELS[languageCode as StreamingLanguage] || languageCode,
    url: readString(raw, 'url', 'file_url', 'fileUrl')
  }
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

// Tolerates both the streaming-assets response and the movie-detail payload,
// in camelCase or snake_case, wrapped or flat.
export function normalizeStreamingState(raw: unknown): StreamingState {
  const status = readString(raw, 'streamingStatus', 'streaming_status', 'status')

  return {
    streamingStatus: (status as StreamingState['streamingStatus']) ?? null,
    hlsUrl: readString(raw, 'hlsUrl', 'hls_url', 'hls_master_url'),
    defaultAudioLanguage: readString(raw, 'defaultAudioLanguage', 'default_audio_language'),
    durationSeconds: readNumber(raw, 'durationSeconds', 'duration_seconds', 'duration_sec'),
    processingError: readString(raw, 'processingError', 'processing_error'),
    audioTracks: toArray(getResourceValue(raw, 'audioTracks') ?? getResourceValue(raw, 'audio_tracks')).map(normalizeAudioTrack),
    subtitles: toArray(getResourceValue(raw, 'subtitles')).map(normalizeSubtitleTrack)
  }
}

export function hasStreamingSignal(state: StreamingState): boolean {
  return Boolean(
    state.streamingStatus ||
    state.hlsUrl ||
    state.audioTracks.length ||
    state.subtitles.length
  )
}
