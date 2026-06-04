<script setup lang="ts">
import type { ApiDebugEntry } from '~/stores/apiDebug'
import type { ApiErrorInfo } from '~/types/api'

definePageMeta({ roles: ['admin', 'super_admin'] })

const api = useApi()
const config = useRuntimeConfig()
const debug = useApiDebugStore()

const filter = ref<'all' | 'errors' | 'pending' | 'events'>('all')
const search = ref('')
const selectedEntryId = ref('')
const health = ref<unknown>(null)
const openApiInfo = ref<unknown>(null)
const backendLogs = ref<Record<string, unknown>[]>([])
const backendLogsRaw = ref<unknown>(null)
const healthLoading = ref(false)
const backendLogsLoading = ref(false)
const healthError = ref<ApiErrorInfo | null>(null)
const backendLogsError = ref<ApiErrorInfo | null>(null)
const logsEndpoint = ref(String(config.public.apiLogsEndpoint || '/api/v1/admin/logs'))
const backendLogSource = ref('pm2:out,pm2:error')
const backendLogLimit = ref(500)
const backendLogSourceOptions = [
  { label: 'PM2 out + error', value: 'pm2:out,pm2:error' },
  { label: 'PM2 error', value: 'pm2:error' },
  { label: 'PM2 out', value: 'pm2:out' },
  { label: 'Все источники', value: '' }
]
const backendLogsRequestPreview = computed(() => {
  const { endpoint } = parseEndpoint(logsEndpoint.value.trim())
  const query = new URLSearchParams()
  if (backendLogSource.value) query.set('source', backendLogSource.value)
  if (backendLogLimit.value) query.set('limit', String(backendLogLimit.value))

  const suffix = query.toString()
  return `GET ${endpoint || '/api/v1/admin/logs'}${suffix ? `?${suffix}` : ''}`
})

const entries = computed(() => {
  const query = search.value.trim().toLowerCase()

  return debug.recentEntries.filter((entry) => {
    if (filter.value === 'errors' && entry.status !== 'error') return false
    if (filter.value === 'pending' && entry.status !== 'pending') return false
    if (filter.value === 'events' && entry.source !== 'admin-event') return false
    if (!query) return true

    return [
      entry.method,
      entry.path,
      entry.url,
      entry.status,
      entry.statusCode,
      entry.message,
      entry.requestId
    ].join(' ').toLowerCase().includes(query)
  })
})

const selectedEntry = computed(() => debug.recentEntries.find((entry) => entry.id === selectedEntryId.value) || entries.value[0])

onMounted(() => {
  debug.load()
  void refreshHealth()
  void refreshBackendLogs()
})

async function refreshHealth() {
  healthLoading.value = true
  healthError.value = null

  try {
    const [healthResponse, openApiResponse] = await Promise.all([
      api.get('/health'),
      api.get('/openapi.json').catch(() => null)
    ])
    health.value = healthResponse
    openApiInfo.value = openApiResponse
  } catch (requestError) {
    healthError.value = requestError as ApiErrorInfo
  } finally {
    healthLoading.value = false
  }
}

async function refreshBackendLogs() {
  const { endpoint, query } = parseEndpoint(logsEndpoint.value.trim())
  if (!endpoint) return

  backendLogsLoading.value = true
  backendLogsError.value = null

  try {
    const response = await api.get(endpoint, {
      ...query,
      source: backendLogSource.value || undefined,
      limit: backendLogLimit.value || undefined
    })
    backendLogsRaw.value = response
    backendLogs.value = normalizeBackendLogs(response)
  } catch (requestError) {
    backendLogsError.value = requestError as ApiErrorInfo
    backendLogs.value = []
    backendLogsRaw.value = null
  } finally {
    backendLogsLoading.value = false
  }
}

function parseEndpoint(value: string): { endpoint: string; query: Record<string, unknown> } {
  const [endpoint, queryString = ''] = value.split('?')
  const query: Record<string, unknown> = {}

  for (const [key, item] of new URLSearchParams(queryString).entries()) {
    query[key] = item
  }

  return { endpoint: endpoint || '/api/v1/admin/logs', query }
}

function normalizeBackendLogs(payload: unknown): Record<string, unknown>[] {
  const directList = normalizeList(payload, ['logs', 'events', 'entries', 'items', 'lines']).items
  if (directList.length) return directList.map((item) => normalizeLogRow(item))

  const record = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null
  if (!record) return []

  const flattened: Record<string, unknown>[] = []
  for (const [source, value] of Object.entries(record)) {
    if (!Array.isArray(value)) continue
    flattened.push(...value.map((item) => normalizeLogRow(item, source)))
  }

  return flattened
}

function normalizeLogRow(value: unknown, source = ''): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return source ? { source, ...(value as Record<string, unknown>) } : value as Record<string, unknown>
  }

  return {
    source,
    message: String(value ?? '')
  }
}

function entryStatusLabel(entry: ApiDebugEntry): string {
  if (entry.status === 'success') return 'Успешно'
  if (entry.status === 'error') return 'Ошибка'
  if (entry.status === 'pending') return 'В процессе'
  return 'Событие'
}

function entryTone(entry: ApiDebugEntry): string {
  if (entry.status === 'success') return 'success'
  if (entry.status === 'error') return 'danger'
  if (entry.status === 'pending') return 'warning'
  return 'neutral'
}

function sourceLabel(entry: ApiDebugEntry): string {
  if (entry.source === 'upload') return 'Загрузка'
  if (entry.source === 'admin-event') return 'Админка'
  return 'API'
}

function formatTime(value: number | string | undefined): string {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

function logTitle(row: Record<string, unknown>): string {
  return String(
    getResourceValue(row, 'message') ||
      getResourceValue(row, 'line') ||
      getResourceValue(row, 'text') ||
      getResourceValue(row, 'msg') ||
      getResourceValue(row, 'event') ||
      getResourceValue(row, 'path') ||
      getResourceValue(row, 'method') ||
      getItemId(row) ||
      'Лог'
  )
}

function logTime(row: Record<string, unknown>): string {
  return formatTime(
    String(
      getResourceValue(row, 'created_at') ||
        getResourceValue(row, 'createdAt') ||
        getResourceValue(row, 'timestamp') ||
        getResourceValue(row, 'date') ||
        getResourceValue(row, 'time') ||
        ''
    )
  )
}

function logSource(row: Record<string, unknown>): string {
  return String(getResourceValue(row, 'source') || getResourceValue(row, 'stream') || getResourceValue(row, 'type') || '')
}
</script>

<template>
  <section class="api-debug-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Отладка API</h1>
        <p class="page-description">
          Последние запросы админки, ошибки клиента, состояние backend и попытка чтения серверных логов.
        </p>
      </div>
      <div class="page-actions">
        <button class="button secondary" type="button" :disabled="healthLoading" @click="refreshHealth">
          <AppIcon name="i-lucide-heart-pulse" :spin="healthLoading" />
          Проверить API
        </button>
        <button class="button secondary" type="button" @click="debug.clear">
          <AppIcon name="i-lucide-trash-2" />
          Очистить журнал
        </button>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 style="margin: 0; font-size: 18px;">Состояние API</h2>
            <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">{{ config.public.apiBaseUrl }}</p>
          </div>
          <StatusBadge :value="healthError ? 'error' : health ? 'active' : 'pending'" />
        </div>
        <div class="panel-body">
          <ApiErrorAlert :error="healthError" />
          <div class="api-debug-meta">
            <span>OpenAPI</span>
            <strong>{{ openApiInfo ? 'доступен' : 'нет ответа' }}</strong>
            <span>Health</span>
            <strong>{{ health ? 'доступен' : 'нет ответа' }}</strong>
          </div>
          <pre v-if="health" class="code api-debug-code">{{ JSON.stringify(health, null, 2) }}</pre>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 style="margin: 0; font-size: 18px;">Логи API сервера</h2>
            <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">Endpoint можно переопределить через NUXT_PUBLIC_API_LOGS_ENDPOINT.</p>
          </div>
          <button class="button secondary" type="button" :disabled="backendLogsLoading" @click="refreshBackendLogs">
            <AppIcon name="i-lucide-refresh-cw" :spin="backendLogsLoading" />
            Загрузить
          </button>
        </div>
        <div class="panel-body api-server-logs">
          <label class="field">
            <span class="field-label">Endpoint логов backend</span>
            <input v-model="logsEndpoint" class="input" type="text" placeholder="/api/v1/admin/logs">
          </label>

          <div class="api-log-controls">
            <label class="field">
              <span class="field-label">Источник</span>
              <select v-model="backendLogSource" class="select">
                <option v-for="option in backendLogSourceOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label class="field">
              <span class="field-label">Лимит</span>
              <input v-model.number="backendLogLimit" class="input" type="number" min="1" max="500">
            </label>
          </div>
          <div class="api-request-preview">{{ backendLogsRequestPreview }}</div>

          <ApiErrorAlert :error="backendLogsError" />

          <div v-if="backendLogs.length" class="api-log-list">
            <article v-for="row in backendLogs.slice(0, 20)" :key="String(getItemId(row) || JSON.stringify(row))" class="api-log-row">
              <div>
                <span class="api-log-row-head">
                  <span v-if="logSource(row)" class="badge neutral">{{ logSource(row) }}</span>
                  <strong>{{ logTitle(row) }}</strong>
                </span>
                <small>{{ logTime(row) }}</small>
              </div>
              <pre>{{ JSON.stringify(row, null, 2) }}</pre>
            </article>
          </div>

          <pre v-else-if="backendLogsRaw" class="code api-debug-code">{{ JSON.stringify(backendLogsRaw, null, 2) }}</pre>
          <p v-else class="field-hint">
            В текущем OpenAPI endpoint серверных логов не указан. Если backend вернет 404, нужен путь логов со стороны API.
          </p>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div>
          <h2 style="margin: 0; font-size: 18px;">Последние логи админки</h2>
          <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">
            Хранятся локально в браузере, максимум 200 записей.
          </p>
        </div>
        <div class="api-debug-counters">
          <span class="badge danger">Ошибок: {{ debug.errorEntries.length }}</span>
          <span class="badge warning">В процессе: {{ debug.pendingEntries.length }}</span>
        </div>
      </div>

      <div class="panel-body">
        <div class="api-debug-toolbar">
          <div class="api-debug-tabs">
            <button class="tag-chip" :class="{ active: filter === 'all' }" type="button" @click="filter = 'all'">Все</button>
            <button class="tag-chip" :class="{ active: filter === 'errors' }" type="button" @click="filter = 'errors'">Ошибки</button>
            <button class="tag-chip" :class="{ active: filter === 'pending' }" type="button" @click="filter = 'pending'">В процессе</button>
            <button class="tag-chip" :class="{ active: filter === 'events' }" type="button" @click="filter = 'events'">Админка</button>
          </div>
          <input v-model="search" class="input api-debug-search" type="search" placeholder="Поиск по endpoint, статусу или requestId">
        </div>

        <div class="api-debug-layout">
          <div class="api-debug-list">
            <button
              v-for="entry in entries"
              :key="entry.id"
              class="api-debug-entry"
              :class="{ active: selectedEntry?.id === entry.id }"
              type="button"
              @click="selectedEntryId = entry.id"
            >
              <span class="badge" :class="entryTone(entry)">{{ entryStatusLabel(entry) }}</span>
              <span class="api-debug-entry-main">
                <strong>{{ entry.method || sourceLabel(entry) }} {{ entry.path || entry.message }}</strong>
                <small>{{ formatTime(entry.createdAt) }} · {{ sourceLabel(entry) }}<template v-if="entry.durationMs"> · {{ entry.durationMs }} ms</template></small>
              </span>
              <span v-if="entry.statusCode" class="api-debug-status">{{ entry.statusCode }}</span>
            </button>

            <div v-if="!entries.length" class="empty-state">Журнал пока пуст</div>
          </div>

          <div class="api-debug-detail">
            <template v-if="selectedEntry">
              <div class="api-debug-detail-head">
                <StatusBadge :value="selectedEntry.statusCode || selectedEntry.status" />
                <strong>{{ selectedEntry.method || sourceLabel(selectedEntry) }} {{ selectedEntry.path || selectedEntry.message }}</strong>
              </div>
              <div class="api-debug-meta">
                <span>Источник</span>
                <strong>{{ sourceLabel(selectedEntry) }}</strong>
                <span>Время</span>
                <strong>{{ formatTime(selectedEntry.createdAt) }}</strong>
                <span>Длительность</span>
                <strong>{{ selectedEntry.durationMs ? `${selectedEntry.durationMs} ms` : '—' }}</strong>
                <span>requestId</span>
                <strong>{{ selectedEntry.requestId || '—' }}</strong>
              </div>
              <pre class="code api-debug-code">{{ JSON.stringify(selectedEntry, null, 2) }}</pre>
            </template>
            <div v-else class="empty-state">Выберите запись</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
