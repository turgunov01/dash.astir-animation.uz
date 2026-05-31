<script setup lang="ts">
import type { ApiErrorInfo, LocalizedText } from '~/types/api'

definePageMeta({ roles: ['admin', 'super_admin'] })

const api = useApi()
const router = useRouter()
const title = ref<LocalizedText>({ ru: '', uz: '', en: '' })
const description = ref<LocalizedText>({ ru: '', uz: '', en: '' })
const series = ref('')
const isPremium = ref(false)
const video = ref<File | null>(null)
const loading = ref(false)
const error = ref<ApiErrorInfo | null>(null)
const result = ref<unknown>(null)

async function submit() {
  error.value = null
  loading.value = true

  try {
    const metadata = {
      title: title.value,
      description: description.value,
      series: parseSeries(),
      is_premium: isPremium.value
    }
    const formData = new FormData()
    formData.append('metadata', JSON.stringify(metadata))
    if (video.value) formData.append('video', video.value)

    result.value = await api.post('/v1/content/movies/create', formData)
    const id = getItemId(unwrapPayload<Record<string, unknown>>(result.value))
    if (id) await router.push(`/content/movies/${id}`)
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    loading.value = false
  }
}

function parseSeries() {
  if (!series.value.trim()) return []
  try {
    return JSON.parse(series.value)
  } catch {
    return series.value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
}
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <NuxtLink class="badge neutral" to="/content/movies">
          <AppIcon name="i-lucide-arrow-left" />
          Назад
        </NuxtLink>
        <h1 class="page-title" style="margin-top: 12px;">Создать фильм</h1>
        <p class="page-description">
          Endpoint ожидает multipart: JSON в поле metadata и видеофайл в поле video. Можно отправить только metadata, если backend это допускает.
        </p>
      </div>
    </div>

    <div class="panel">
      <div class="panel-body">
        <form class="form-grid" @submit.prevent="submit">
          <ApiErrorAlert :error="error" />
          <LocalizedTextFields v-model="title" label="Название" />
          <LocalizedTextFields v-model="description" label="Описание" :rows="4" />
          <div class="field">
            <span class="field-label">Series IDs</span>
            <textarea v-model="series" class="textarea" rows="4" placeholder='["series-id-1"] или id1,id2' />
          </div>
          <label style="display: flex; align-items: center; gap: 10px;">
            <input v-model="isPremium" type="checkbox">
            <span>Премиум контент</span>
          </label>
          <UploadDropzone v-model="video" accept="video/*" label="Выберите видеофайл" />
          <div style="display: flex; justify-content: flex-end;">
            <button class="button" type="submit" :disabled="loading">
              <AppIcon :name="loading ? 'i-lucide-loader-circle' : 'i-lucide-upload'" :spin="loading" />
              {{ loading ? 'Загрузка...' : 'Создать фильм' }}
            </button>
          </div>
        </form>
        <pre v-if="result" class="code" style="margin-top: 14px;">{{ JSON.stringify(result, null, 2) }}</pre>
      </div>
    </div>
  </section>
</template>
