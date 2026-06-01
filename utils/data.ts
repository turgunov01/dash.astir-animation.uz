import type { LocalizedText, ResourceColumn } from '~/types/api'

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
  const keys = [preferredKey, 'id', '_id', 'uuid', 'movie_id', 'category_id', 'tariff_id', 'child_id', 'user_id']

  for (const key of keys) {
    const value = getObjectValue(source, key)
    if (typeof value === 'string' || typeof value === 'number') return value
  }

  return undefined
}

export function unwrapPayload<T = unknown>(payload: unknown): T {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (record.data !== undefined) return record.data as T
    if (record.result !== undefined) return record.result as T
  }

  return payload as T
}

export function normalizeList(payload: unknown): { items: Record<string, unknown>[]; total?: number } {
  const unwrapped = unwrapPayload(payload)

  if (Array.isArray(unwrapped)) {
    return { items: unwrapped as Record<string, unknown>[], total: unwrapped.length }
  }

  if (unwrapped && typeof unwrapped === 'object') {
    const record = unwrapped as Record<string, unknown>
    const candidates = [
      record.items,
      record.results,
      record.rows,
      record.docs,
      record.list,
      record.records,
      record.entities,
      record.data,
      record.movies,
      record.categories,
      record.series,
      record.episodes,
      record.children,
      record.users,
      record.tariffs,
      record.subscriptions,
      record.transactions,
      record.cards,
      record.chats,
      record.faqs,
      record.content,
      record.contents
    ]
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

export function formatCellValue(row: Record<string, unknown>, column: ResourceColumn): string {
  const value = getObjectValue(row, column.key)

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

function buildPathCandidates(path: string): string[] {
  const snake = path.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  const camel = path.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
  return [...new Set([path, snake, camel])]
}
