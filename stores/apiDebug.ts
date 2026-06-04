import type { ApiMethod } from '~/types/api'

type ApiDebugStatus = 'pending' | 'success' | 'error' | 'info'
type ApiDebugSource = 'admin-ui' | 'upload' | 'admin-event'

interface StartRequestPayload {
  method: ApiMethod
  path: string
  baseUrl?: string
  query?: Record<string, unknown>
  body?: unknown
  source?: ApiDebugSource
}

interface FinishRequestPayload {
  status: 'success' | 'error'
  statusCode?: number
  durationMs?: number
  response?: unknown
  errorMessage?: string
  errorCode?: string
  requestId?: string
}

export interface ApiDebugEntry {
  id: string
  source: ApiDebugSource
  status: ApiDebugStatus
  method?: ApiMethod
  path?: string
  url?: string
  query?: unknown
  requestBody?: unknown
  responseBody?: unknown
  statusCode?: number
  durationMs?: number
  message?: string
  errorCode?: string
  requestId?: string
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'astir_api_debug_entries'
const MAX_ENTRIES = 200
const SENSITIVE_KEY_PATTERN = /(password|token|secret|authorization|cookie|otp|pin)/i

export const useApiDebugStore = defineStore('apiDebug', () => {
  const entries = ref<ApiDebugEntry[]>([])
  const loaded = ref(false)

  const recentEntries = computed(() => [...entries.value].sort((a, b) => b.createdAt - a.createdAt))
  const errorEntries = computed(() => recentEntries.value.filter((entry) => entry.status === 'error'))
  const pendingEntries = computed(() => recentEntries.value.filter((entry) => entry.status === 'pending'))

  function load() {
    if (!process.client || loaded.value) return
    loaded.value = true

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw)
      entries.value = Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : []
    } catch {
      entries.value = []
    }
  }

  function startRequest(payload: StartRequestPayload): string {
    load()

    const now = Date.now()
    const id = createEntryId()
    const entry: ApiDebugEntry = {
      id,
      source: payload.source || 'admin-ui',
      status: 'pending',
      method: payload.method,
      path: payload.path,
      url: buildUrl(payload.baseUrl || '', payload.path),
      query: sanitizeValue(payload.query),
      requestBody: summarizePayload(payload.body),
      createdAt: now,
      updatedAt: now
    }

    entries.value = [entry, ...entries.value].slice(0, MAX_ENTRIES)
    persist()
    return id
  }

  function finishRequest(id: string | undefined, payload: FinishRequestPayload) {
    if (!id) return

    load()
    const entry = entries.value.find((item) => item.id === id)
    if (!entry) return

    entry.status = payload.status
    entry.statusCode = payload.statusCode
    entry.durationMs = payload.durationMs
    entry.responseBody = summarizePayload(payload.response)
    entry.message = payload.errorMessage
    entry.errorCode = payload.errorCode
    entry.requestId = payload.requestId
    entry.updatedAt = Date.now()
    persist()
  }

  function addAdminEvent(message: string, details?: unknown) {
    load()

    const now = Date.now()
    const entry: ApiDebugEntry = {
      id: createEntryId(),
      source: 'admin-event',
      status: 'info',
      message,
      responseBody: summarizePayload(details),
      createdAt: now,
      updatedAt: now
    }

    entries.value = [entry, ...entries.value].slice(0, MAX_ENTRIES)
    persist()
  }

  function clear() {
    entries.value = []
    if (process.client) window.localStorage.removeItem(STORAGE_KEY)
  }

  function persist() {
    if (!process.client) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.value.slice(0, MAX_ENTRIES)))
  }

  return {
    entries,
    recentEntries,
    errorEntries,
    pendingEntries,
    load,
    startRequest,
    finishRequest,
    addAdminEvent,
    clear
  }
})

function createEntryId(): string {
  return `api-debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (!baseUrl) return path
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

function summarizePayload(value: unknown): unknown {
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    const entries: Record<string, unknown>[] = []
    value.forEach((entryValue, key) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        entries.push({ key, value: '[hidden]' })
        return
      }

      if (typeof File !== 'undefined' && entryValue instanceof File) {
        entries.push({ key, file: entryValue.name, type: entryValue.type, size: entryValue.size })
        return
      }

      if (typeof Blob !== 'undefined' && entryValue instanceof Blob) {
        entries.push({ key, blob: true, type: entryValue.type, size: entryValue.size })
        return
      }

      entries.push({ key, value: truncateText(String(entryValue)) })
    })

    return { type: 'FormData', entries }
  }

  return sanitizeValue(value)
}

function sanitizeValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string') return truncateText(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof Blob !== 'undefined' && value instanceof Blob) return { blob: true, type: value.type, size: value.size }
  if (depth > 3) return '[truncated]'

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1, seen))
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]'
    seen.add(value)

    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(record).slice(0, 40).map(([key, item]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '[hidden]' : sanitizeValue(item, depth + 1, seen)
      ])
    )
  }

  return String(value)
}

function truncateText(value: string): string {
  return value.length > 1200 ? `${value.slice(0, 1200)}...` : value
}
