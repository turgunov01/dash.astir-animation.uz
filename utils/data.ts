import type { LocalizedText, ResourceColumn } from '~/types/api'

const resourceEntityKeys = [
  'item',
  'record',
  'entity',
  'content',
  'category',
  'tag',
  'movie',
  'series',
  'tariff',
  'user',
  'child',
  'subscription',
  'transaction',
  'card',
  'chat',
  'message',
  'support_message',
  'comment',
  'faq'
]

export function getObjectValue(source: unknown, path: string): unknown {
  if (!source || typeof source !== 'object') return undefined

  for (const candidate of buildPathCandidates(path)) {
    const value = candidate.split('.').reduce<unknown>((current, part) => {
      if (!current || typeof current !== 'object') return undefined
      return (current as Record<string, unknown>)[part]
    }, source)

    if (value !== undefined && value !== null) return value
  }

  return undefined
}

export function getItemId(source: unknown, preferredKey = 'id'): string | number | undefined {
  const keys = [preferredKey, 'id', '_id', 'uuid', 'movie_id', 'category_id', 'tag_id', 'tariff_id', 'child_id', 'user_id', 'chat_id', 'message_id', 'comment_id']

  for (const key of keys) {
    const value = getObjectValue(source, key)
    if (typeof value === 'string' || typeof value === 'number') return value
  }

  for (const key of keys) {
    const value = getResourceValue(source, key)
    if (typeof value === 'string' || typeof value === 'number') return value
  }

  return undefined
}

export function unwrapPayload<T = unknown>(payload: unknown, preferredEntityKeys: string | string[] = []): T {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (record.data !== undefined) return record.data as T
    if (record.result !== undefined) return record.result as T

    for (const key of mergePreferredKeys(preferredEntityKeys, resourceEntityKeys)) {
      const value = record[key]
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as T
    }
  }

  return payload as T
}

export function normalizeList(payload: unknown, preferredListKeys: string | string[] = []): { items: Record<string, unknown>[]; total?: number } {
  const unwrapped = unwrapPayload(payload, preferredListKeys)

  if (Array.isArray(unwrapped)) {
    return { items: unwrapped as Record<string, unknown>[], total: unwrapped.length }
  }

  if (unwrapped && typeof unwrapped === 'object') {
    const record = unwrapped as Record<string, unknown>
    const defaultKeys = [
      'items',
      'results',
      'rows',
      'docs',
      'list',
      'records',
      'entities',
      'data',
      'logs',
      'events',
      'lines',
      'movies',
      'categories',
      'tags',
      'series',
      'episodes',
      'children',
      'users',
      'tariffs',
      'subscriptions',
      'transactions',
      'cards',
      'chats',
      'messages',
      'comments',
      'faqs',
      'content',
      'contents'
    ]
    const candidates = mergePreferredKeys(preferredListKeys, defaultKeys).map((key) => record[key])
    const list = candidates.find(Array.isArray)

    if (Array.isArray(list)) {
      return {
        items: list as Record<string, unknown>[],
        total: extractTotal(record) ?? list.length
      }
    }

  }

  return { items: [], total: 0 }
}

export function resolveEndpoint(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => encodeURIComponent(String(values[key] ?? '')))
}

export function pickLocalized(value: unknown, preferred: keyof LocalizedText = 'ru'): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)

  if (value && typeof value === 'object') {
    const localized = value as LocalizedText
    return localized[preferred] || localized.ru || localized.uz || localized.en || Object.values(localized)[0] || ''
  }

  return ''
}

export function pickMediaPath(value: unknown): string {
  if (typeof value === 'string') return value

  if (value && typeof value === 'object') {
    for (const key of [
      'url',
      'src',
      'path',
      'source',
      'poster_url',
      'posterUrl',
      'image_url',
      'imageUrl',
      'thumbnail_url',
      'thumbnailUrl',
      'icon_url',
      'iconUrl'
    ]) {
      const nested = getObjectValue(value, key)
      if (typeof nested === 'string' && nested.trim()) return nested
    }
  }

  return ''
}

export function getResourceValue(source: unknown, path: string): unknown {
  const record = toRecord(source)
  if (!record) return undefined

  const direct = getCandidateValue(record, path)
  if (direct !== undefined) return direct

  const metadataValue = getCandidateValue(toRecord(getObjectValue(record, 'metadata')), path)
  if (metadataValue !== undefined) return metadataValue

  for (const entityKey of resourceEntityKeys) {
    const entity = toRecord(getObjectValue(record, entityKey))
    const entityValue = getCandidateValue(entity, path)
    if (entityValue !== undefined) return entityValue

    const entityMetadataValue = getCandidateValue(toRecord(getObjectValue(entity, 'metadata')), path)
    if (entityMetadataValue !== undefined) return entityMetadataValue
  }

  return undefined
}

export function formatCellValue(row: Record<string, unknown>, column: ResourceColumn): string {
  const value = getResourceValue(row, column.key)

  if (column.kind === 'localized') return pickLocalized(value)
  if (column.kind === 'date') return formatDateTime(value)
  if (column.kind === 'boolean') return value ? 'Да' : 'Нет'
  if (column.kind === 'json') return value === undefined ? '' : JSON.stringify(value)
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return pickLocalized(value) || JSON.stringify(value)

  return String(value)
}

export function formatDateTime(value: unknown): string {
  if (!value) return ''
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

function numericValue(value: unknown): number | undefined {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

function extractTotal(record: Record<string, unknown>): number | undefined {
  const direct =
    numericValue(record.total) ??
    numericValue(record.count) ??
    numericValue(record.totalCount) ??
    numericValue(record.total_items) ??
    numericValue(record.totalItems)

  if (direct !== undefined) return direct

  for (const key of ['meta', 'pagination']) {
    const nested = record[key]
    if (nested && typeof nested === 'object') {
      const nestedRecord = nested as Record<string, unknown>
      const nestedTotal =
        numericValue(nestedRecord.total) ??
        numericValue(nestedRecord.count) ??
        numericValue(nestedRecord.totalCount) ??
        numericValue(nestedRecord.total_items) ??
        numericValue(nestedRecord.totalItems)

      if (nestedTotal !== undefined) return nestedTotal
    }
  }

  return undefined
}

function mergePreferredKeys(preferredKeys: string | string[], fallbackKeys: string[]): string[] {
  const preferred = Array.isArray(preferredKeys) ? preferredKeys : [preferredKeys]
  return [...new Set([...preferred.filter(Boolean), ...fallbackKeys])]
}

function getCandidateValue(source: Record<string, unknown> | undefined, path: string): unknown {
  if (!source) return undefined

  for (const candidate of buildValuePathCandidates(path)) {
    const value = getObjectValue(source, candidate)
    if (value !== undefined) return value
  }

  return undefined
}

function buildValuePathCandidates(path: string): string[] {
  if (path.includes('.')) return [path]

  const aliases: Record<string, string[]> = {
    active: ['is_active', 'isActive', 'enabled'],
    icon: ['icon_url', 'iconUrl', 'image', 'thumbnail'],
    slug: ['code'],
    title: ['name', 'label'],
    type: ['category_type', 'categoryType', 'content_type', 'contentType', 'kind']
  }

  return [...new Set([path, ...(aliases[path] || [])])]
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return toRecord(parsed)
    } catch {
      return undefined
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return undefined
}

function buildPathCandidates(path: string): string[] {
  const snake = path.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  const camel = path.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
  return [...new Set([path, snake, camel])]
}
