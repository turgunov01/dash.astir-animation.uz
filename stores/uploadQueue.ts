import type { ApiMethod } from '~/types/api'
import { getItemId, unwrapPayload } from '~/utils/data'

type UploadTaskStatus = 'queued' | 'uploading' | 'processing' | 'success' | 'error' | 'cancelled'

interface UploadRequest {
  endpoint: string
  method?: ApiMethod
  body: FormData
  label?: string
  resultRouteBase?: string
}

interface UploadHttpResponse {
  status: number
  body: unknown
}

interface PersistedUploadRequest {
  id: string
  label: string
  endpoint: string
  method: ApiMethod
  resultRouteBase?: string
  totalBytes: number
  createdAt: number
  entries: PersistedFormDataEntry[]
}

type PersistedFormDataEntry =
  | {
      key: string
      kind: 'text'
      value: string
    }
  | {
      key: string
      kind: 'file'
      blob: Blob
      name: string
      type: string
      lastModified: number
    }

export interface UploadTask {
  id: string
  label: string
  endpoint: string
  method: ApiMethod
  status: UploadTaskStatus
  progress: number
  uploadedBytes: number
  totalBytes: number
  etaSeconds?: number
  error?: string
  responseStatus?: number
  response?: unknown
  resultRoute?: string
  startedAt: number
  updatedAt: number
  completedAt?: number
}

const activeRequests = new Map<string, XMLHttpRequest>()
const UPLOAD_SPEED_STORAGE_KEY = 'astir_upload_bytes_per_second'
const UPLOAD_DB_NAME = 'astir_upload_queue'
const UPLOAD_DB_VERSION = 1
const UPLOAD_STORE_NAME = 'uploads'

export const useUploadQueueStore = defineStore('uploadQueue', () => {
  const tasks = ref<UploadTask[]>([])
  const restored = ref(false)

  const activeTasks = computed(() =>
    tasks.value.filter((task) => ['queued', 'uploading', 'processing'].includes(task.status))
  )
  const hasActiveTasks = computed(() => activeTasks.value.length > 0)

  function enqueue(request: UploadRequest) {
    if (!process.client) {
      throw new Error('Background uploads are available only in the browser')
    }

    const totalBytes = estimateFormDataSize(request.body)
    const savedSpeed = readSavedUploadSpeed()
    const task: UploadTask = {
      id: createTaskId(),
      label: request.label || buildUploadLabel(request.body, request.endpoint),
      endpoint: request.endpoint,
      method: request.method || 'POST',
      status: 'queued',
      progress: 0,
      uploadedBytes: 0,
      totalBytes,
      etaSeconds: savedSpeed && totalBytes ? Math.ceil(totalBytes / savedSpeed) : undefined,
      startedAt: Date.now(),
      updatedAt: Date.now()
    }

    tasks.value.unshift(task)
    const promise = persistUploadRequest(task, request)
      .catch((error) => {
        updateTask(task.id, {
          error: `Не удалось сохранить локальную копию: ${error instanceof Error ? error.message : String(error)}`
        })
      })
      .then(() => runTask(task.id, request))
    void promise.catch(() => undefined)

    return { task, promise }
  }

  async function restorePersistedUploads() {
    if (!process.client || restored.value) return
    restored.value = true

    const persistedUploads = await readPersistedUploads().catch(() => [])
    for (const persisted of persistedUploads) {
      if (tasks.value.some((task) => task.id === persisted.id)) continue

      const savedSpeed = readSavedUploadSpeed()
      const task: UploadTask = {
        id: persisted.id,
        label: persisted.label,
        endpoint: persisted.endpoint,
        method: persisted.method,
        status: 'queued',
        progress: 0,
        uploadedBytes: 0,
        totalBytes: persisted.totalBytes,
        etaSeconds: savedSpeed && persisted.totalBytes ? Math.ceil(persisted.totalBytes / savedSpeed) : undefined,
        startedAt: Date.now(),
        updatedAt: Date.now()
      }
      const body = restoreFormData(persisted.entries)

      tasks.value.unshift(task)
      void runTask(task.id, {
        endpoint: persisted.endpoint,
        method: persisted.method,
        body,
        label: persisted.label,
        resultRouteBase: persisted.resultRouteBase
      }).catch(() => undefined)
    }
  }

  async function runTask(id: string, request: UploadRequest, attempt = 0): Promise<unknown> {
    const apiDebug = process.client ? useApiDebugStore() : null
    const debugId = apiDebug?.startRequest({
      method: request.method || 'POST',
      path: request.endpoint,
      baseUrl: String(useRuntimeConfig().public.apiBaseUrl || ''),
      body: request.body,
      source: 'upload'
    })
    const startedAt = Date.now()

    updateTask(id, {
      status: 'uploading',
      progress: 0,
      uploadedBytes: 0,
      startedAt: Date.now(),
      error: undefined
    })

    try {
      const response = await uploadWithXhr(id, request)
      const task = findTask(id)
      if (task) saveUploadSpeed(task.uploadedBytes || task.totalBytes, task.startedAt)
      updateTask(id, {
        status: 'success',
        progress: 100,
        uploadedBytes: findTask(id)?.totalBytes || findTask(id)?.uploadedBytes || 0,
        etaSeconds: 0,
        responseStatus: response.status,
        response: response.body,
        resultRoute: buildResultRoute(response.body, request.resultRouteBase),
        completedAt: Date.now()
      })
      apiDebug?.finishRequest(debugId, {
        status: 'success',
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        response: response.body
      })
      void deletePersistedUpload(id)
      return response.body
    } catch (error) {
      const uploadError = normalizeUploadError(error)

      if (uploadError.statusCode === 401 && attempt === 0) {
        const auth = useAuthStore()
        if (await auth.refresh()) {
          apiDebug?.finishRequest(debugId, {
            status: 'error',
            statusCode: uploadError.statusCode,
            durationMs: Date.now() - startedAt,
            response: uploadError.raw,
            errorMessage: '401, повтор после refresh token',
            errorCode: uploadError.code
          })
          return runTask(id, request, attempt + 1)
        }
      }

      updateTask(id, {
        status: uploadError.code === 'cancelled' ? 'cancelled' : 'error',
        error: uploadError.message,
        responseStatus: uploadError.statusCode,
        response: uploadError.raw,
        completedAt: Date.now(),
        etaSeconds: undefined
      })
      if (uploadError.code === 'cancelled' || (uploadError.statusCode && uploadError.statusCode < 500)) {
        void deletePersistedUpload(id)
      }
      apiDebug?.finishRequest(debugId, {
        status: 'error',
        statusCode: uploadError.statusCode,
        durationMs: Date.now() - startedAt,
        response: uploadError.raw,
        errorMessage: uploadError.message,
        errorCode: uploadError.code
      })
      throw uploadError
    } finally {
      activeRequests.delete(id)
    }
  }

  function cancel(id: string) {
    void deletePersistedUpload(id)
    activeRequests.get(id)?.abort()
  }

  function dismiss(id: string) {
    const task = findTask(id)
    if (!task || ['queued', 'uploading', 'processing'].includes(task.status)) return
    void deletePersistedUpload(id)
    tasks.value = tasks.value.filter((entry) => entry.id !== id)
  }

  function clearFinished() {
    for (const task of tasks.value) {
      if (!['queued', 'uploading', 'processing'].includes(task.status)) {
        void deletePersistedUpload(task.id)
      }
    }
    tasks.value = tasks.value.filter((task) => ['queued', 'uploading', 'processing'].includes(task.status))
  }

  function updateTask(id: string, patch: Partial<UploadTask>) {
    const task = findTask(id)
    if (!task) return
    Object.assign(task, patch, { updatedAt: Date.now() })
  }

  function findTask(id: string) {
    return tasks.value.find((task) => task.id === id)
  }

  return {
    tasks,
    activeTasks,
    hasActiveTasks,
    enqueue,
    restorePersistedUploads,
    cancel,
    dismiss,
    clearFinished
  }
})

function uploadWithXhr(id: string, request: UploadRequest): Promise<UploadHttpResponse> {
  return new Promise((resolve, reject) => {
    const config = useRuntimeConfig()
    const auth = useAuthStore()
    const uploadQueue = useUploadQueueStore()
    const xhr = new XMLHttpRequest()
    const url = buildApiUrl(String(config.public.apiBaseUrl || ''), request.endpoint)

    activeRequests.set(id, xhr)
    xhr.open(request.method || 'POST', url, true)
    xhr.setRequestHeader('Accept', 'application/json')
    if (auth.accessToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${auth.accessToken}`)
    }

    xhr.upload.onprogress = (event) => {
      const task = uploadQueue.tasks.find((entry) => entry.id === id)
      if (!task) return

      const uploadedBytes = event.loaded
      const totalBytes = event.lengthComputable ? event.total : task.totalBytes
      const elapsedSeconds = Math.max((Date.now() - task.startedAt) / 1000, 0.5)
      const measuredSpeed = uploadedBytes / elapsedSeconds
      const fallbackSpeed = readSavedUploadSpeed()
      const speed = measuredSpeed > 0 ? measuredSpeed : fallbackSpeed
      const etaSeconds =
        speed && totalBytes > uploadedBytes ? Math.ceil((totalBytes - uploadedBytes) / speed) : undefined

      uploadQueue.$patch((state) => {
        const current = state.tasks.find((entry) => entry.id === id)
        if (!current) return
        current.status = 'uploading'
        current.progress = totalBytes ? Math.min(99, Math.floor((uploadedBytes / totalBytes) * 100)) : 0
        current.uploadedBytes = uploadedBytes
        current.totalBytes = totalBytes || current.totalBytes
        current.etaSeconds = etaSeconds
        current.updatedAt = Date.now()
      })
    }

    xhr.upload.onload = () => {
      uploadQueue.$patch((state) => {
        const task = state.tasks.find((entry) => entry.id === id)
        if (!task || task.status === 'cancelled') return
        task.status = 'processing'
        task.progress = Math.max(task.progress, 99)
        task.uploadedBytes = task.totalBytes || task.uploadedBytes
        task.etaSeconds = undefined
        task.updatedAt = Date.now()
      })
    }

    xhr.onload = () => {
      const response = parseXhrResponse(xhr)
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ status: xhr.status, body: response })
        return
      }

      reject({
        statusCode: xhr.status,
        message: getResponseMessage(response) || xhr.statusText || 'Не удалось загрузить файл',
        raw: response
      })
    }

    xhr.onerror = () => reject({ message: 'Сеть прервала загрузку файла' })
    xhr.onabort = () => reject({ code: 'cancelled', message: 'Загрузка отменена' })
    xhr.send(request.body)
  })
}

function buildApiUrl(baseUrl: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint
  return `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`
}

function createTaskId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function estimateFormDataSize(body: FormData): number {
  let size = 0
  body.forEach((value) => {
    if (value instanceof Blob) {
      size += value.size
      return
    }
    size += new TextEncoder().encode(String(value)).length
  })
  return size
}

function buildUploadLabel(body: FormData, endpoint: string): string {
  const fileNames: string[] = []
  body.forEach((value) => {
    if (value instanceof File) fileNames.push(value.name)
  })
  return fileNames.length ? fileNames.join(', ') : endpoint
}

async function persistUploadRequest(task: UploadTask, request: UploadRequest): Promise<void> {
  if (!process.client) return

  const persisted: PersistedUploadRequest = {
    id: task.id,
    label: task.label,
    endpoint: request.endpoint,
    method: request.method || 'POST',
    resultRouteBase: request.resultRouteBase,
    totalBytes: task.totalBytes,
    createdAt: task.startedAt,
    entries: serializeFormData(request.body)
  }

  const db = await openUploadDb()
  await runUploadStoreRequest(db, 'readwrite', (store) => store.put(persisted))
  db.close()
}

async function readPersistedUploads(): Promise<PersistedUploadRequest[]> {
  if (!process.client) return []

  const db = await openUploadDb()
  const uploads = await runUploadStoreRequest<PersistedUploadRequest[]>(db, 'readonly', (store) => store.getAll())
  db.close()
  return uploads.sort((a, b) => a.createdAt - b.createdAt)
}

async function deletePersistedUpload(id: string): Promise<void> {
  if (!process.client) return

  const db = await openUploadDb()
  await runUploadStoreRequest(db, 'readwrite', (store) => store.delete(id))
  db.close()
}

function serializeFormData(body: FormData): PersistedFormDataEntry[] {
  const entries: PersistedFormDataEntry[] = []

  body.forEach((value, key) => {
    if (value instanceof Blob) {
      entries.push({
        key,
        kind: 'file',
        blob: value,
        name: value instanceof File ? value.name : key,
        type: value.type || 'application/octet-stream',
        lastModified: value instanceof File ? value.lastModified : Date.now()
      })
      return
    }

    entries.push({
      key,
      kind: 'text',
      value: String(value)
    })
  })

  return entries
}

function restoreFormData(entries: PersistedFormDataEntry[]): FormData {
  const body = new FormData()

  for (const entry of entries) {
    if (entry.kind === 'text') {
      body.append(entry.key, entry.value)
      continue
    }

    const file =
      typeof File !== 'undefined'
        ? new File([entry.blob], entry.name, { type: entry.type, lastModified: entry.lastModified })
        : entry.blob
    body.append(entry.key, file, entry.name)
  }

  return body
}

function openUploadDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(UPLOAD_DB_NAME, UPLOAD_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(UPLOAD_STORE_NAME)) {
        db.createObjectStore(UPLOAD_STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Не удалось открыть локальное хранилище upload'))
  })
}

function runUploadStoreRequest<T = unknown>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(UPLOAD_STORE_NAME, mode)
    const store = transaction.objectStore(UPLOAD_STORE_NAME)
    const request = action(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Не удалось выполнить операцию upload queue'))
    transaction.onerror = () => reject(transaction.error || new Error('Ошибка транзакции upload queue'))
  })
}

function readSavedUploadSpeed(): number | undefined {
  if (!process.client) return undefined
  const value = Number(window.localStorage.getItem(UPLOAD_SPEED_STORAGE_KEY))
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function saveUploadSpeed(bytes: number, startedAt: number) {
  if (!process.client) return
  const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 1)
  const speed = bytes / elapsedSeconds
  if (!Number.isFinite(speed) || speed <= 0) return

  const previous = readSavedUploadSpeed()
  const blended = previous ? previous * 0.7 + speed * 0.3 : speed
  window.localStorage.setItem(UPLOAD_SPEED_STORAGE_KEY, String(Math.round(blended)))
}

function parseXhrResponse(xhr: XMLHttpRequest): unknown {
  if (!xhr.responseText) return null
  try {
    return JSON.parse(xhr.responseText)
  } catch {
    return xhr.responseText
  }
}

function buildResultRoute(response: unknown, base?: string): string | undefined {
  if (!base) return undefined
  const id = getResponseItemId(response)
  return id === undefined ? undefined : `${base.replace(/\/$/, '')}/${encodeURIComponent(String(id))}`
}

function getResponseItemId(response: unknown): string | number | undefined {
  const payload = unwrapPayload<Record<string, unknown>>(response)
  const directId = getItemId(payload)
  if (directId !== undefined) return directId

  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>
  const containers = [record.movie, record.content, record.item, record.record, record.entity, record.result, record.data]

  for (const container of containers) {
    const id = getItemId(container)
    if (id !== undefined) return id
  }

  return undefined
}

function getResponseMessage(response: unknown): string {
  if (!response || typeof response !== 'object') return ''
  const record = response as Record<string, unknown>
  const error = record.error
  const message = record.message

  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>
    if (typeof errorRecord.message === 'string') return errorRecord.message
  }
  if (typeof message === 'string') return message

  return ''
}

function normalizeUploadError(error: unknown): { code?: string; message: string; statusCode?: number; raw?: unknown } {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    return {
      code: typeof record.code === 'string' ? record.code : undefined,
      message: typeof record.message === 'string' ? record.message : 'Не удалось загрузить файл',
      statusCode: typeof record.statusCode === 'number' ? record.statusCode : undefined,
      raw: record.raw
    }
  }

  return { message: 'Не удалось загрузить файл' }
}
