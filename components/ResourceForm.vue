<script setup lang="ts">
import { z } from 'zod'
import type { ApiErrorInfo, ApiMethod, ResourceField } from '~/types/api'

const props = withDefaults(
  defineProps<{
    fields?: ResourceField[]
    endpoint?: string
    method?: ApiMethod
    initialValue?: Record<string, unknown> | null
    submitLabel?: string
    context?: Record<string, unknown>
    pathParams?: string[]
    backgroundUploads?: boolean
    backgroundRedirectTo?: string
    backgroundLabel?: string
    backgroundResultRouteBase?: string
  }>(),
  {
    fields: () => [],
    method: 'POST',
    initialValue: null,
    submitLabel: 'Сохранить',
    context: () => ({}),
    pathParams: () => [],
    backgroundUploads: true,
    backgroundRedirectTo: '',
    backgroundLabel: '',
    backgroundResultRouteBase: ''
  }
)

const emit = defineEmits<{
  success: [value: unknown]
}>()

const api = useApi()
const config = useRuntimeConfig()
const router = useRouter()
const uploadQueue = useUploadQueueStore()
const model = reactive<Record<string, unknown>>({})
const loading = ref(false)
const error = ref<ApiErrorInfo | null>(null)
const seriesOptions = ref<Array<{ label: string; value: string | number }>>([])

watch(
  () => [props.fields, props.initialValue],
  () => {
    for (const field of props.fields) {
      const existing = props.initialValue ? getObjectValue(props.initialValue, field.key) : undefined
      if (existing !== undefined) {
        model[field.key] =
          field.key === 'series'
            ? normalizeSeriesValue(existing)
            : field.type === 'json' && typeof existing === 'object'
              ? JSON.stringify(existing, null, 2)
              : existing
      } else if (field.defaultValue !== undefined) {
        model[field.key] = field.defaultValue
      } else if (field.type === 'localized') {
        model[field.key] = { ru: '', uz: '', en: '' }
      } else if (field.type === 'checkbox') {
        model[field.key] = false
      } else {
        model[field.key] = ''
      }
    }
  },
  { immediate: true }
)

watch(
  () => props.fields,
  () => {
    if (props.fields.some((field) => field.key === 'series')) void loadSeriesOptions()
  },
  { immediate: true }
)

async function submit() {
  error.value = null
  const validation = buildSchema().safeParse(model)

  if (!validation.success) {
    error.value = { message: validation.error.issues[0]?.message || 'Проверьте поля формы' }
    return
  }

  if (!props.endpoint) {
    emit('success', { ...model })
    return
  }

  loading.value = true
  try {
    const values = { ...props.context, ...model }
    const endpoint = resolveEndpoint(props.endpoint, values)
    const body = buildBody()

    if (props.backgroundUploads && body instanceof FormData && formDataHasFile(body)) {
      const { task } = uploadQueue.enqueue({
        endpoint,
        method: props.method,
        body,
        label: props.backgroundLabel || buildUploadLabel(body, endpoint),
        resultRouteBase: props.backgroundResultRouteBase
      })

      if (props.backgroundRedirectTo) {
        await router.push(props.backgroundRedirectTo)
      } else {
        emit('success', { queued: true, uploadTaskId: task.id })
      }
      return
    }

    const result = await api.request(endpoint, {
      method: props.method,
      body: props.method === 'GET' ? undefined : body,
      query: props.method === 'GET' ? (body as Record<string, unknown>) : undefined
    })
    emit('success', result)
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    loading.value = false
  }
}

function buildSchema() {
  const shape = Object.fromEntries(
    props.fields
      .filter((field) => field.required)
      .map((field) => [
        field.key,
        z.unknown().refine((value) => hasFieldValue(value), `${field.label}: обязательное поле`)
      ])
  )

  return z.object(shape)
}

function buildBody(): Record<string, unknown> | FormData {
  const bodyFields = props.fields.filter((field) => field.send !== false && !props.pathParams.includes(field.key))
  const hasFile = bodyFields.some((field) => field.type === 'file' && model[field.key])

  if (hasFile) {
    const formData = new FormData()
    for (const field of bodyFields) {
      const value = parseFieldValue(field)
      if (value === undefined || value === null || value === '') continue
      if (value instanceof File) {
        formData.append(field.key, value)
      } else if (typeof value === 'object') {
        formData.append(field.key, JSON.stringify(value))
      } else {
        formData.append(field.key, String(value))
      }
    }
    return formData
  }

  return Object.fromEntries(
    bodyFields
      .map((field) => [field.key, parseFieldValue(field)] as const)
      .filter(([, value]) => value !== undefined && value !== '')
  )
}

function parseFieldValue(field: ResourceField): unknown {
  const value = model[field.key]

  if (field.key === 'series') {
    return value ? [value] : []
  }

  if (field.type === 'json' && typeof value === 'string' && value.trim()) {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  return value
}

function formDataHasFile(body: FormData): boolean {
  let hasFile = false
  body.forEach((value) => {
    if (typeof File !== 'undefined' && value instanceof File) hasFile = true
  })
  return hasFile
}

function buildUploadLabel(body: FormData, endpoint: string): string {
  const files: string[] = []
  body.forEach((value) => {
    if (typeof File !== 'undefined' && value instanceof File) files.push(value.name)
  })
  return files.length ? `Загрузка: ${files.join(', ')}` : `Загрузка: ${endpoint}`
}

function hasFieldValue(value: unknown): boolean {
  if (value instanceof File) return true
  if (typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  if (value && typeof value === 'object') return Object.values(value).some((entry) => String(entry || '').trim())
  return false
}

function stringFieldValue(key: string): string {
  const value = model[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function setStringFieldValue(key: string, value: string) {
  model[key] = value
}

function shouldRenderReadySource(field: ResourceField): boolean {
  if (field.key !== 'source') return false
  const source = model[field.key]
  if (typeof source !== 'string' || !source.trim()) return false

  const status = String(
    getObjectValue(props.initialValue, 'transcode_status') ||
      getObjectValue(props.initialValue, 'transcodeStatus') ||
      model.transcode_status ||
      model.transcodeStatus ||
      ''
  ).toLowerCase()

  return status === 'ready'
}

function mediaUrl(value: unknown): string {
  const source = String(value || '')
  if (!source) return ''
  if (/^https?:\/\//i.test(source)) return source

  const baseUrl = String(config.public.apiBaseUrl || '').replace(/\/$/, '')
  return `${baseUrl}/${source.replace(/^\//, '')}`
}

async function loadSeriesOptions() {
  try {
    const response = await api.get('/api/v1/series', { limit: 100 })
    seriesOptions.value = normalizeList(response).items
      .map((item) => {
        const id = getItemId(item)
        return id === undefined ? null : { label: pickLocalized(getObjectValue(item, 'title')) || String(id), value: id }
      })
      .filter((item): item is { label: string; value: string | number } => Boolean(item))
  } catch {
    seriesOptions.value = []
  }
}

function normalizeSeriesValue(value: unknown): string | number | '' {
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === 'string' || typeof first === 'number') return first
    const id = getItemId(first)
    return id ?? ''
  }

  if (typeof value === 'string' || typeof value === 'number') return value

  const id = getItemId(value)
  return id ?? ''
}
</script>

<template>
  <form class="form-grid" @submit.prevent="submit">
    <ApiErrorAlert :error="error" />

    <template v-for="field in fields" :key="field.key">
      <LocalizedTextFields
        v-if="field.type === 'localized'"
        v-model="model[field.key]"
        :label="field.label"
        :rows="field.rows || 1"
      />

      <div v-else-if="field.type === 'checkbox'" class="field">
        <label style="display: flex; align-items: center; gap: 10px; min-height: 40px;">
          <input v-model="model[field.key]" type="checkbox">
          <span>{{ field.label }}</span>
        </label>
        <small v-if="field.help" style="color: var(--muted);">{{ field.help }}</small>
      </div>

      <div v-else-if="field.type === 'file'" class="field">
        <span class="field-label">{{ field.label }}</span>
        <UploadDropzone v-model="model[field.key]" :accept="field.accept || ''" :label="field.placeholder || 'Выберите файл'" />
        <small v-if="field.help" style="color: var(--muted);">{{ field.help }}</small>
      </div>

      <div v-else class="field">
        <span class="field-label">{{ field.label }}</span>
        <select v-if="field.type === 'select' && field.key === 'series'" v-model="model[field.key]" class="select">
          <option value="">Без сериала</option>
          <option v-for="option in seriesOptions" :key="String(option.value)" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <select v-else-if="field.type === 'select'" v-model="model[field.key]" class="select">
          <option value="">Выберите</option>
          <option v-for="option in field.options || []" :key="String(option.value)" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <video
          v-else-if="shouldRenderReadySource(field)"
          class="media-source-player"
          :src="mediaUrl(model[field.key])"
          controls
          preload="metadata"
        >
          Ваш браузер не поддерживает видео.
        </video>
        <textarea
          v-else-if="field.type === 'textarea' || field.type === 'json'"
          :value="stringFieldValue(field.key)"
          class="textarea"
          :rows="field.rows || (field.type === 'json' ? 6 : 4)"
          :placeholder="field.placeholder"
          @input="setStringFieldValue(field.key, ($event.target as HTMLTextAreaElement).value)"
        />
        <input
          v-else
          v-model="model[field.key]"
          class="input"
          :type="field.type === 'number' ? 'number' : field.type"
          :placeholder="field.placeholder"
        >
        <small v-if="field.help" style="color: var(--muted);">{{ field.help }}</small>
      </div>
    </template>

    <div style="display: flex; justify-content: flex-end; gap: 8px;">
      <button class="button" type="submit" :disabled="loading">
        <AppIcon :name="loading ? 'i-lucide-loader-circle' : 'i-lucide-save'" :spin="loading" />
        {{ loading ? 'Сохранение...' : submitLabel }}
      </button>
    </div>
  </form>
</template>
