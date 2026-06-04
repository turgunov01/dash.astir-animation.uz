import { getResourceValue } from '~/utils/data'

const WAITING_STATUSES = ['pending', 'queued', 'waiting', 'uploaded']
const PROCESSING_STATUSES = ['processing', 'in_progress', 'transcoding']
const READY_STATUSES = ['ready', 'done', 'completed', 'complete']
const ERROR_STATUSES = ['failed', 'fail', 'error', 'unavailable']
const DRAFT_STATUSES = ['draft', 'new', 'created', 'inactive', 'unpublished', 'disabled']
const MISSING_SOURCE_STATUSES = ['missing_source', 'no_source', 'source_missing']
const PUBLISHED_STATUSES = ['published', 'active', 'enabled']

export function transcodeStatusValue(row: Record<string, unknown> | null | undefined): string {
  return String(
    getResourceValue(row, 'transcode_status') ??
    getResourceValue(row, 'playback.status') ??
    getResourceValue(row, 'status') ??
    ''
  ).trim().toLowerCase()
}

export function transcodeStatusLabel(row: Record<string, unknown> | null | undefined): string {
  const status = transcodeStatusValue(row)
  const progress = transcodeProgressPercent(row)
  const suffix = progress !== undefined && (isWaitingStatus(status) || isProcessingStatus(status)) ? ` ${progress}%` : ''

  if (isErrorStatus(status)) return 'Ошибка'
  if (isReadyStatus(status)) return 'Готово'
  if (isProcessingStatus(status)) return `Обработка${suffix}`
  if (isWaitingStatus(status)) return `В очереди${suffix}`
  if (isMissingSourceStatus(status)) return 'Видео не загружено'
  if (isDraftStatus(status) || publishedState(row) === false) return 'Черновик'
  if (isPublishedStatus(status) || publishedState(row) === true) return 'Опубликовано'

  return status ? status : 'Опубликовано'
}

export function transcodeStatusTone(row: Record<string, unknown> | null | undefined): string {
  const status = transcodeStatusValue(row)

  if (isErrorStatus(status)) return 'danger'
  if (isWaitingStatus(status) || isProcessingStatus(status)) return 'warning'
  if (isReadyStatus(status)) return 'success'
  if (isPublishedStatus(status) || publishedState(row) === true) return 'success'
  if (isDraftStatus(status) || isMissingSourceStatus(status) || publishedState(row) === false) return 'neutral'

  return 'success'
}

export function transcodeProgressPercent(row: Record<string, unknown> | null | undefined): number | undefined {
  const explicit = explicitProgressPercent(row)
  if (explicit !== undefined) return explicit

  const status = transcodeStatusValue(row)
  if (isReadyStatus(status)) return 100
  if (isWaitingStatus(status)) return 0

  if (isProcessingStatus(status)) {
    const estimated = renditionProgressPercent(row)
    return estimated === undefined ? 0 : Math.min(99, estimated)
  }

  return undefined
}

export function transcodeProgressVisible(row: Record<string, unknown> | null | undefined): boolean {
  const status = transcodeStatusValue(row)
  return (isWaitingStatus(status) || isProcessingStatus(status)) && transcodeProgressPercent(row) !== undefined
}

function explicitProgressPercent(row: Record<string, unknown> | null | undefined): number | undefined {
  const values = [
    getResourceValue(row, 'transcode_progress'),
    getResourceValue(row, 'transcodeProgress'),
    getResourceValue(row, 'transcoding_progress'),
    getResourceValue(row, 'processing_progress'),
    getResourceValue(row, 'progress_percent'),
    getResourceValue(row, 'progressPercent'),
    getResourceValue(row, 'percent'),
    getResourceValue(row, 'percentage'),
    getResourceValue(row, 'progress'),
    getResourceValue(row, 'playback.progress'),
    getResourceValue(row, 'playback.progress_percent'),
    getResourceValue(row, 'playback.progressPercent'),
    getResourceValue(row, 'media.progress'),
    getResourceValue(row, 'media.transcode_progress'),
    getResourceValue(row, 'transcode.progress'),
    getResourceValue(row, 'transcoding.progress')
  ]

  for (const value of values) {
    const percent = normalizeProgressPercent(value)
    if (percent !== undefined) return percent
  }

  return undefined
}

function renditionProgressPercent(row: Record<string, unknown> | null | undefined): number | undefined {
  const renditions = getResourceValue(row, 'playback.renditions')
  if (!Array.isArray(renditions)) return undefined

  const completed = renditions.filter((rendition) => {
    if (!rendition || typeof rendition !== 'object') return false
    return Boolean(getResourceValue(rendition, 'playlist_url') || getResourceValue(rendition, 'playlistUrl') || getResourceValue(rendition, 'url'))
  }).length

  const expected = expectedRenditionsCount(row)
  if (!expected) return completed ? 99 : undefined

  return Math.max(0, Math.min(100, Math.round((completed / expected) * 100)))
}

function expectedRenditionsCount(row: Record<string, unknown> | null | undefined): number {
  const qualities = getResourceValue(row, 'playback.qualities')
  if (Array.isArray(qualities)) {
    const expected = qualities.filter((quality) => String(quality).toLowerCase() !== 'auto').length
    if (expected > 0) return expected
  }

  return 4
}

function normalizeProgressPercent(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['percent', 'percentage', 'progress', 'value']) {
      const percent = normalizeProgressPercent(record[key])
      if (percent !== undefined) return percent
    }
    return undefined
  }

  const number = Number(String(value).trim().replace(',', '.').replace(/%$/, ''))
  if (!Number.isFinite(number)) return undefined

  const percent = number > 0 && number <= 1 ? number * 100 : number
  return Math.max(0, Math.min(100, Math.round(percent)))
}

function publishedState(row: Record<string, unknown> | null | undefined): boolean | undefined {
  const value =
    getResourceValue(row, 'published') ??
    getResourceValue(row, 'is_published') ??
    getResourceValue(row, 'isPublished') ??
    getResourceValue(row, 'active')

  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0

  const normalized = String(value).toLowerCase()
  if (['true', '1', 'yes', 'да', 'published', 'active'].includes(normalized)) return true
  if (['false', '0', 'no', 'нет', 'draft', 'inactive', 'unpublished'].includes(normalized)) return false

  return undefined
}

function isWaitingStatus(status: string) {
  return WAITING_STATUSES.includes(status)
}

function isProcessingStatus(status: string) {
  return PROCESSING_STATUSES.includes(status)
}

function isReadyStatus(status: string) {
  return READY_STATUSES.includes(status)
}

function isErrorStatus(status: string) {
  return ERROR_STATUSES.includes(status)
}

function isDraftStatus(status: string) {
  return DRAFT_STATUSES.includes(status)
}

function isMissingSourceStatus(status: string) {
  return MISSING_SOURCE_STATUSES.includes(status)
}

function isPublishedStatus(status: string) {
  return PUBLISHED_STATUSES.includes(status)
}
